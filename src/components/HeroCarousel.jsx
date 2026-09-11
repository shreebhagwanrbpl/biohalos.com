"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ArrowRight,
  PhoneCall,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  Film,
} from "lucide-react";

// Default high-quality fallback slides if database has no media configured yet
const FALLBACK_SLIDES = [
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1900&q=80",
    title: "Precision Medical Equipment & Diagnostic Solutions",
    subtitle:
      "Equipping hospitals, pathology centers, and clinical laboratories with top-tier automated analyzers, NABL-traceable calibration, and 24/7 rapid technical engineering support across India.",
    tag: "Clinical Chemistry & Diagnostics",
  },
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1900&q=80",
    title: "Automated Clinical Chemistry & Pathology Analyzers",
    subtitle:
      "High-throughput diagnostic instruments delivering rapid test results with uncompromised quality control and ISO 13485 certified accuracy standards.",
    tag: "Pathology & Molecular Testing",
  },
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1900&q=80",
    title: "24/7 Biomedical Engineering & AMC Support",
    subtitle:
      "Guaranteed 2-hour emergency repair SLA for critical ICU, OT, and pathology laboratory equipment with genuine OEM parts.",
    tag: "Hospital Support & AMC SLAs",
  },
];

export default function HeroCarousel({
  homeData = null,
  locationTitle = "",
  makeLink = (path) => path,
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const videoRefs = useRef({});

  // Parse media items from Firestore home data
  const parseMediaList = (data) => {
    if (!data) return [];
    const list = [];

    // 1. Check media array (preferred)
    if (Array.isArray(data.media) && data.media.length > 0) {
      data.media.forEach((item, idx) => {
        const url = typeof item === "string" ? item : item?.url;
        const type =
          item?.type ||
          (url?.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)
            ? "video"
            : "image");

        if (url) {
          list.push({
            id: `media-${idx}`,
            type,
            url,
            tag: item?.title || item?.tag || `Featured Diagnostic ${idx + 1}`,
          });
        }
      });
    }

    // 2. Check images array
    if (
      list.length === 0 &&
      Array.isArray(data.images) &&
      data.images.length > 0
    ) {
      data.images.forEach((url, idx) => {
        if (url) {
          list.push({
            id: `img-${idx}`,
            type: "image",
            url,
            tag: `Diagnostic Solution 0${idx + 1}`,
          });
        }
      });
    }

    // 3. Check single imageUrl / image
    if (list.length === 0 && (data.imageUrl || data.image)) {
      const singleImg = data.imageUrl || data.image;

      if (singleImg) {
        list.push({
          id: "single-img",
          type: "image",
          url: singleImg,
          tag: "Biomedical Systems",
        });
      }
    }

    // 4. Check videos array
    if (Array.isArray(data.videos) && data.videos.length > 0) {
      data.videos.forEach((vUrl, idx) => {
        if (vUrl && !list.some((item) => item.url === vUrl)) {
          list.push({
            id: `vid-${idx}`,
            type: "video",
            url: vUrl,
            tag: "Clinical Video Feature",
          });
        }
      });
    }

    // 5. Check single videoUrl
    if (
      data.videoUrl &&
      !list.some((item) => item.url === data.videoUrl)
    ) {
      list.push({
        id: "single-vid",
        type: "video",
        url: data.videoUrl,
        tag: "Clinical Video Feature",
      });
    }

    return list;
  };

  const dbSlides = parseMediaList(homeData);

  // Images remain dynamic with static fallback
  const slides = dbSlides.length > 0 ? dbSlides : FALLBACK_SLIDES;

  // Dynamic texts from Firestore only — NO static fallback
  const heroTitle = homeData?.title?.trim() || "";
  const heroDescription = homeData?.description?.trim() || "";
  const btn1Text = homeData?.button1Text?.trim() || "";
  const btn2Text = homeData?.button2Text?.trim() || "";

  // Static routes for buttons
  const btn1Href = makeLink("/items");
  const btn2Href = makeLink("/contact");

  // Auto-slide effect
  useEffect(() => {
    if (!isPlaying || slides.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [isPlaying, slides.length, currentSlide]);

  // Adjust active slide index safely
  useEffect(() => {
    if (currentSlide >= slides.length && slides.length > 0) {
      setCurrentSlide(slides.length - 1);
    }
  }, [slides.length, currentSlide]);

  // Play video on current slide
  useEffect(() => {
    const currentMedia = slides[currentSlide];

    if (currentMedia?.type === "video") {
      const vid = videoRefs.current[currentSlide];

      if (vid) {
        vid.currentTime = 0;
        vid.play().catch(() => { });
      }
    }
  }, [currentSlide, slides]);

  const handlePrev = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + slides.length) % slides.length
    );
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  // Touch swipe support for mobile
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  const activeMedia = slides[currentSlide] || slides[0];

  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      {/* Background Media Viewport - Editorial Format */}
      <div
        className="relative w-full min-h-[460px] sm:min-h-[520px] md:min-h-[580px] lg:min-h-[620px] overflow-hidden flex flex-col justify-between"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Background Image / Video Layer */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full z-0"
          >
            {activeMedia?.type === "video" ? (
              <video
                ref={(el) =>
                  (videoRefs.current[currentSlide] = el)
                }
                src={activeMedia.url}
                className="w-full h-full object-cover object-center"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              />
            ) : (
              <img
                src={activeMedia?.url}
                alt={`Hero Slide ${currentSlide + 1}`}
                className="w-full h-full object-cover object-center brightness-[0.88] contrast-[1.08]"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = FALLBACK_SLIDES[0].url;
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Editorial Film Overlay Gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent lg:w-3/4 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40 z-10" />

        {/* Top Editorial Scrim Bar */}
        <div className="container-custom relative z-20 pt-8 sm:pt-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />

            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
              {locationTitle
                ? `Biomedical Supply Edition // ${locationTitle}`
                : "Raj Biosis // Biomedical Engineering"}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/80 px-3.5 py-1 text-xs font-semibold backdrop-blur-md text-white">
            <span className="font-mono text-emerald-400">
              0{currentSlide + 1}
            </span>

            <span className="text-slate-400">/</span>

            <span className="font-mono text-slate-400">
              0{slides.length}
            </span>
          </div>
        </div>

        {/* Center Editorial Typography Content */}
        <div className="container-custom relative z-20 py-8 sm:py-12 my-auto">
          <div className="max-w-2xl lg:max-w-3xl">
            {/* Editorial Kicker Badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-slate-900/80 px-3.5 py-1.5 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-100 shadow-lg backdrop-blur-md"
            >
              <Sparkles size={13} className="text-emerald-400" />

              <span>
                {activeMedia?.tag ||
                  "NABL-Traceable Diagnostic Equipment"}
              </span>
            </motion.div>

            {/* Editorial Title */}
            {heroTitle && (
              <motion.h1
                key={`title-${currentSlide}-${heroTitle}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mt-4 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08] drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
              >
                {heroTitle}
              </motion.h1>
            )}

            {/* Editorial Subtitle */}
            {heroDescription && (
              <motion.p
                key={`desc-${currentSlide}-${heroDescription}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-4 text-sm sm:text-base md:text-lg leading-relaxed text-slate-200 max-w-2xl font-normal drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]"
              >
                {heroDescription}
              </motion.p>
            )}

            {/* High-Contrast Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3 sm:gap-4"
            >
              {/* Button 1 — Text Dynamic, Link Static */}
              {btn1Text && (
                <Link
                  href={btn1Href}
                  className="flex items-center justify-center gap-2.5 rounded-2xl bg-white !text-slate-950 px-7 py-3.5 text-sm font-bold shadow-2xl transition-all duration-300 hover:bg-slate-100 hover:shadow-2xl hover:-translate-y-0.5"
                >
                  <span className="!text-slate-950 font-bold">
                    {btn1Text}
                  </span>

                  <ArrowRight
                    size={16}
                    className="!text-slate-950 stroke-[2.5]"
                  />
                </Link>
              )}

              {/* Button 2 — Text Dynamic, Link Static */}
              {btn2Text && (
                <Link
                  href={btn2Href}
                  className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/40 bg-slate-900/80 !text-white px-7 py-3.5 text-sm font-bold backdrop-blur-md shadow-lg transition-all duration-300 hover:bg-white hover:!text-slate-950 hover:border-white hover:-translate-y-0.5"
                >
                  <PhoneCall
                    size={16}
                    className="text-emerald-400"
                  />

                  <span className="font-bold">
                    {btn2Text}
                  </span>
                </Link>
              )}
            </motion.div>
          </div>
        </div>

        {/* Bottom Editorial Chapter Bar */}
        <div className="container-custom relative z-20 pb-6 sm:pb-8 pt-4 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Numbered Editorial Slide Tabs */}
            <div className="flex items-center gap-3 sm:gap-6 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
              {slides.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`group text-left transition-all shrink-0 ${currentSlide === idx
                    ? "opacity-100"
                    : "opacity-50 hover:opacity-80"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-emerald-400">
                      0{idx + 1}
                    </span>

                    <span className="text-xs font-bold text-white tracking-wide uppercase">
                      {s.tag
                        ? s.tag.length > 24
                          ? `${s.tag.slice(0, 24)}...`
                          : s.tag
                        : `Slide 0${idx + 1}`}
                    </span>
                  </div>

                  <div className="mt-1.5 h-0.5 w-full bg-white/20 overflow-hidden rounded-full">
                    {currentSlide === idx && (
                      <motion.div
                        layoutId="editorialProgress"
                        className="h-full bg-emerald-400 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{
                          duration: 6,
                          ease: "linear",
                        }}
                      />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Editorial Floating Controls */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                title={
                  isPlaying
                    ? "Pause Slideshow"
                    : "Play Slideshow"
                }
                className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/80 text-white backdrop-blur-md border border-white/20 hover:bg-slate-800 transition-all shadow-md"
              >
                {isPlaying ? (
                  <Pause size={13} />
                ) : (
                  <Play size={13} />
                )}
              </button>

              <button
                type="button"
                onClick={handlePrev}
                title="Previous Slide"
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-900/80 text-white backdrop-blur-md border border-white/20 hover:bg-white hover:text-slate-950 transition-all shadow-md"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                onClick={handleNext}
                title="Next Slide"
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-900/80 text-white backdrop-blur-md border border-white/20 hover:bg-white hover:text-slate-950 transition-all shadow-md"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}