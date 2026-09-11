"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { usePathname } from "next/navigation";
import { makeSlug } from "@/data/productsData";
import { fetchAllDynamicProducts } from "@/lib/fetchProducts";

import {
    FaPlay,
    FaShareAlt,
    FaWhatsapp,
    FaFacebook,
    FaInstagram,
    FaLink,
} from "react-icons/fa";

import {
    doc,
    getDoc,
    addDoc,
    collection,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Microscope, ShieldCheck, Download, Send, CheckCircle2, ChevronDown, Award, PhoneCall } from "lucide-react";

const loadImageBase64 = async (src) => {
    try {
        if (!src || typeof src !== "string") {
            throw new Error("Invalid image source");
        }

        if (!src.startsWith("http")) {
            return new Promise((resolve, reject) => {
                const img = new window.Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0);
                    try {
                        resolve(canvas.toDataURL("image/png"));
                    } catch (e) {
                        reject(e);
                    }
                };
                img.onerror = (e) => reject(e);
                img.src = src;
            });
        }

        // Method 1: Fetch via local proxy (bypasses CORS securely)
        try {
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
            const response = await fetch(proxyUrl);
            if (response.ok) {
                const blob = await response.blob();
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error("FileReader failed"));
                    reader.readAsDataURL(blob);
                });
            }
        } catch (proxyErr) {
            console.warn("Proxy method failed, falling back to direct fetch...", proxyErr);
        }

        // Method 2: Direct fetch fallback
        try {
            const response = await fetch(src, { cache: "no-cache" });
            if (response.ok) {
                const blob = await response.blob();
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error("FileReader failed"));
                    reader.readAsDataURL(blob);
                });
            }
        } catch (fetchErr) {
            console.warn("fetch method failed, falling back to canvas method...", fetchErr);
        }

        // Method 3: Fallback to HTML Image element
        return await new Promise((resolve, reject) => {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                try {
                    resolve(canvas.toDataURL("image/png"));
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = (e) => reject(new Error("Image element load failed"));
            img.src = src;
        });
    } catch (err) {
        console.error("loadImageBase64 failed for src:", src, err);
        throw err;
    }
};

const getProductSpecs = (product) => {
    const specsMap = new Map();

    const standardFields = [
        ["Brand", "brand"],
        ["Model", "model"],
        ["Instrument", "instrument"],
        ["Category", "category"],
        ["Capacity", "capacity"],
        ["Throughput", "throughput"],
        ["Usage", "usage"],
        ["Automation", "automation"],
        ["Availability", "availability"]
    ];

    standardFields.forEach(([label, key]) => {
        const val = product[key];
        if (val && String(val).trim() && String(val).trim() !== "N/A") {
            specsMap.set(label, String(val).trim());
        }
    });

    const blacklist = new Set([
        "title", "desc", "description", "image", "images", "slug",
        "uid", "video", "pdf", "isPublished", "category", "subCategory",
        "brand", "model", "instrument", "capacity", "throughput",
        "usage", "automation", "availability",
        "price", "categoryProductId", "category_product_id", "categoryproductid",
        "id", "createdAt", "created_at", "createdat"
    ]);

    if (product.parameters && typeof product.parameters === "string") {
        const parts = product.parameters.split("|");
        parts.forEach((part) => {
            const colonIndex = part.indexOf(":");
            if (colonIndex !== -1) {
                const label = part.substring(0, colonIndex).trim();
                const value = part.substring(colonIndex + 1).trim();
                const lowerLabel = label.toLowerCase();
                if (
                    label &&
                    value &&
                    value !== "N/A" &&
                    !blacklist.has(lowerLabel) &&
                    !lowerLabel.includes("price") &&
                    !lowerLabel.includes("id")
                ) {
                    const cleanLabel = label.replace(/\b\w/g, (c) => c.toUpperCase());
                    specsMap.set(cleanLabel, value);
                }
            }
        });
    }

    if (product.specs && typeof product.specs === "object") {
        if (Array.isArray(product.specs)) {
            product.specs.forEach((item) => {
                if (item && item.label && item.value && String(item.value).trim() !== "N/A") {
                    specsMap.set(item.label, String(item.value).trim());
                }
            });
        } else {
            Object.entries(product.specs).forEach(([k, v]) => {
                if (v && String(v).trim() && String(v).trim() !== "N/A") {
                    const label = k.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
                    specsMap.set(label, String(v).trim());
                }
            });
        }
    }

    return Array.from(specsMap.entries());
};

const getWebsiteDomain = () => {
    if (typeof window !== "undefined") {
        const host = window.location.hostname;
        if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
            return host;
        }
    }
    return "biohalos.com";
};

export default function ProductDetails({ slug }) {
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [selectedImage, setSelectedImage] = useState("");
    const [selectedMedia, setSelectedMedia] = useState("image");
    const [showShare, setShowShare] = useState(false);
    const [contactInfo, setContactInfo] = useState([]);
    const [downloadingBrochure, setDownloadingBrochure] = useState(false);

    const shareRef = useRef();
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
    });

    const [submitting, setSubmitting] = useState(false);
    const pathname = usePathname();

    const specificationsList = useMemo(() => {
        if (!product) return [];
        const list = [];
        const added = new Set();

        const addSpec = (label, val) => {
            if (val === null || val === undefined || typeof val === "object") return;
            const strVal = String(val).trim();
            if (!strVal || strVal === "N/A" || strVal.toLowerCase() === "null" || strVal.toLowerCase() === "undefined") return;
            const keyLower = label.toLowerCase().trim();
            if (!added.has(keyLower)) {
                added.add(keyLower);
                list.push({ label, value: strVal });
            }
        };

        // Standard dynamic admin fields
        if (product.brand) addSpec("Brand", product.brand);
        if (product.model) addSpec("Model", product.model);
        if (product.instrument) addSpec("Instrument", product.instrument);
        if (product.capacity) addSpec("Capacity", product.capacity);
        if (product.throughput) addSpec("Throughput", product.throughput);
        if (product.usage) addSpec("Usage / Application", product.usage);
        if (product.automation) addSpec("Automation", product.automation);
        if (product.size) addSpec("Size / Dimensions", product.size);
        if (product.availability || product.status) addSpec("Availability", product.availability || product.status);
        if (product.category) addSpec("Category", product.category);
        if (product.subCategory) addSpec("Sub Category", product.subCategory);
        if (product.categoryProductId) addSpec("Product ID", product.categoryProductId);

        // Parse parameters string
        if (product.parameters && typeof product.parameters === "string") {
            if (product.parameters.includes("|") || product.parameters.includes(":")) {
                const parts = product.parameters.split("|");
                parts.forEach((part) => {
                    const colonIndex = part.indexOf(":");
                    if (colonIndex !== -1) {
                        const lbl = part.substring(0, colonIndex).trim();
                        const val = part.substring(colonIndex + 1).trim();
                        if (lbl && val) {
                            addSpec(lbl.replace(/\b\w/g, (c) => c.toUpperCase()), val);
                        }
                    } else if (part.trim()) {
                        addSpec("Parameters", part.trim());
                    }
                });
            } else {
                addSpec("Parameters", product.parameters);
            }
        }

        // Parse custom specs object
        if (product.specs && typeof product.specs === "object") {
            if (Array.isArray(product.specs)) {
                product.specs.forEach((item) => {
                    if (item && item.label && item.value) {
                        addSpec(item.label, item.value);
                    } else if (typeof item === "string" && item.includes(":")) {
                        const [k, v] = item.split(":");
                        addSpec(k.trim(), v.trim());
                    }
                });
            } else {
                Object.entries(product.specs).forEach(([k, v]) => {
                    if (v && typeof v !== "object") {
                        const cleanLabel = k.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
                        addSpec(cleanLabel, v);
                    }
                });
            }
        }

        return list;
    }, [product]);

    const pathParts = pathname
        .split("/")
        .filter(Boolean);

    const city =
        pathParts.length > 1
            ? pathParts[0]
            : "India";

    const cityName =
        city.charAt(0).toUpperCase() +
        city.slice(1);

    useEffect(() => {
        const loadProduct = async () => {
            try {
                const allProducts = await fetchAllDynamicProducts();

                let found = allProducts.find(
                    (p) => p.slug === slug || makeSlug(p.title) === slug || p.id === slug
                );

                if (found) {
                    setProduct(found);
                    const mainImg =
                        (Array.isArray(found.images) && found.images[0]) ||
                        found.image ||
                        found.imgUrl ||
                        found.imageUrl ||
                        "/logo.png";
                    setSelectedImage(mainImg);
                    setSelectedMedia("image");
                } else if (allProducts.length > 0) {
                    // Fallback to closest match or first dynamic item
                    setProduct(allProducts[0]);
                    const mainImg =
                        (Array.isArray(allProducts[0].images) && allProducts[0].images[0]) ||
                        allProducts[0].image ||
                        "/logo.png";
                    setSelectedImage(mainImg);
                }
            } catch (error) {
                console.error("Error loading product:", error);
            } finally {
                setLoading(false);
            }
        };

        loadProduct();
    }, [slug]);

    useEffect(() => {
        const loadContact = async () => {
            try {
                const snap = await getDoc(
                    doc(db, "websites", "biohaloscom", "pages", "contact")
                );
                if (snap.exists()) {
                    setContactInfo(snap.data().contactInfo || []);
                }
            } catch (err) {
                console.error("Error loading contact info in details:", err);
            }
        };
        loadContact();
    }, []);

    const handleDownloadBrochure = async () => {
        if (!product) return;
        try {
            setDownloadingBrochure(true);
            const { jsPDF } = await import("jspdf");
            const pdfDoc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
            });

            const pageWidth = pdfDoc.internal.pageSize.getWidth();
            const pageHeight = pdfDoc.internal.pageSize.getHeight();
            const margin = 14;
            const contentWidth = pageWidth - margin * 2;

            // Colors
            const colorPrimary = [15, 23, 42];
            const colorDark = [30, 41, 59];
            const colorGray = [100, 116, 139];
            const colorLightBorder = [226, 232, 240];
            const colorBgWarm = [248, 250, 252];

            // 1. HEADER BAR
            pdfDoc.setFillColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            pdfDoc.rect(0, 0, pageWidth, 24, "F");

            pdfDoc.setTextColor(255, 255, 255);
            pdfDoc.setFont("helvetica", "bold");
            pdfDoc.setFontSize(14);
            pdfDoc.text("RAJ BIOSIS PRIVATE LIMITED", margin, 12);

            pdfDoc.setFont("helvetica", "normal");
            pdfDoc.setFontSize(8.5);
            pdfDoc.text("Official Technical Specification & Quotation Sheet", margin, 18);

            pdfDoc.setFontSize(8);
            pdfDoc.text(getWebsiteDomain(), pageWidth - margin, 14, { align: "right" });

            // 2. PRODUCT TITLE & CATEGORY
            let currentY = 32;
            pdfDoc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            pdfDoc.setFont("helvetica", "bold");
            pdfDoc.setFontSize(15);
            const titleLines = pdfDoc.splitTextToSize(product.title, contentWidth);
            pdfDoc.text(titleLines, margin, currentY);
            currentY += titleLines.length * 6;

            const categoryText = product.subCategory && product.subCategory !== product.category
                ? `${product.category} • ${product.subCategory}`
                : product.category || "Biomedical Equipment";
            pdfDoc.setFont("helvetica", "normal");
            pdfDoc.setFontSize(9);
            pdfDoc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            pdfDoc.text(`Category: ${categoryText}`, margin, currentY);
            currentY += 8;

            // 3. IMAGE
            const targetImg = selectedImage || product.image || (Array.isArray(product.images) && product.images[0]);
            let imgRendered = false;
            let imgHeight = 0;

            if (targetImg && targetImg !== "/logo.png") {
                try {
                    const base64Data = await loadImageBase64(targetImg);
                    if (base64Data) {
                        const imgBoxW = 75;
                        const imgBoxH = 55;
                        pdfDoc.addImage(base64Data, "PNG", margin, currentY, imgBoxW, imgBoxH, undefined, "FAST");
                        imgRendered = true;
                        imgHeight = imgBoxH;
                    }
                } catch (imgErr) {
                    console.warn("Could not load image for PDF:", imgErr);
                }
            }

            // 4. OVERVIEW / DESCRIPTION
            const descX = imgRendered ? margin + 82 : margin;
            const descW = imgRendered ? contentWidth - 82 : contentWidth;

            pdfDoc.setFont("helvetica", "bold");
            pdfDoc.setFontSize(10.5);
            pdfDoc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            pdfDoc.text("Product Overview", descX, currentY + 4);

            pdfDoc.setFont("helvetica", "normal");
            pdfDoc.setFontSize(8);
            pdfDoc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);

            let descText = product.desc || product.description || "High precision diagnostic instrument engineered for clinical accuracy.";
            if (descText.length > 250) {
                descText = descText.substring(0, 250) + "...";
            }
            const descLines = pdfDoc.splitTextToSize(descText, descW);
            pdfDoc.text(descLines, descX, currentY + 10);

            currentY += Math.max(imgHeight, descLines.length * 4 + 14) + 8;

            // 5. SPECIFICATIONS
            pdfDoc.setFont("helvetica", "bold");
            pdfDoc.setFontSize(11);
            pdfDoc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            pdfDoc.text("Technical Specifications", margin, currentY);
            currentY += 6;

            const specs = getProductSpecs(product);
            pdfDoc.setFontSize(8);

            for (let i = 0; i < specs.length; i++) {
                const label = specs[i][0];
                const value = String(specs[i][1]);

                if (i % 2 === 0) {
                    pdfDoc.setFillColor(colorBgWarm[0], colorBgWarm[1], colorBgWarm[2]);
                    pdfDoc.rect(margin, currentY - 3.5, contentWidth, 5, "F");
                }

                pdfDoc.setFont("helvetica", "bold");
                pdfDoc.setTextColor(colorDark[0], colorDark[1], colorDark[2]);
                pdfDoc.text(`${label}:`, margin + 2, currentY);

                pdfDoc.setFont("helvetica", "normal");
                pdfDoc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
                const valueLines = pdfDoc.splitTextToSize(value, contentWidth - 45);
                pdfDoc.text(valueLines, margin + 42, currentY);

                currentY += Math.max(valueLines.length * 3.8, 5);

                if (currentY > pageHeight - 22) {
                    pdfDoc.addPage();
                    currentY = margin + 10;
                }
            }

            // 6. FOOTER
            pdfDoc.setDrawColor(colorLightBorder[0], colorLightBorder[1], colorLightBorder[2]);
            pdfDoc.setLineWidth(0.4);
            pdfDoc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

            pdfDoc.setFont("helvetica", "italic");
            pdfDoc.setFontSize(7.5);
            pdfDoc.setTextColor(colorGray[0], colorGray[1], colorGray[2]);
            pdfDoc.text(
                "Raj Biosis Private Limited | NABL-Traceable Calibration • 24/7 SLA Engineering Support",
                pageWidth / 2,
                pageHeight - 9,
                { align: "center" }
            );

            pdfDoc.save(`${product.title.replace(/\s+/g, "_")}_Brochure.pdf`);
            toast.success("Brochure downloaded successfully!");
        } catch (e) {
            console.error("Error creating PDF brochure:", e);
            toast.error("Failed to generate brochure PDF.");
        } finally {
            setDownloadingBrochure(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const phoneRegex = /^[6-9]\d{9}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!form.name.trim()) {
            return toast.error("Name is required");
        }

        if (!emailRegex.test(form.email)) {
            return toast.error("Enter valid email");
        }

        if (!phoneRegex.test(form.phone)) {
            return toast.error("Enter valid mobile number");
        }

        try {
            setSubmitting(true);

            await addDoc(
                collection(
                    db,
                    "websitesQueries",
                    "biohaloscom",
                    "productQueries"
                ),
                {
                    ...form,
                    productName: product.title,
                    productSlug: product.slug,
                    brand: product.brand || "",
                    model: product.model || "",
                    createdAt: new Date(),
                }
            );

            toast.success("Your enquiry has been submitted successfully. Our specialist will contact you.");

            setForm({
                name: "",
                email: "",
                phone: "",
            });
        } catch (error) {
            console.error(error);
            toast.error("Something went wrong");
        } finally {
            setSubmitting(false);
        }
    };

    const productSchema = product
        ? {
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.title,
            image: product.image ? [product.image] : [],
            description: product.desc || product.description || product.title,
            brand: {
                "@type": "Brand",
                name: product.brand || "Raj Biosis Private Limited",
            },
        }
        : null;

    const faqSchema = product
        ? {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
                {
                    "@type": "Question",
                    name: `What is ${product.title} used for?`,
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: `${product.title} is used in hospitals, pathology labs and diagnostic centres for clinical precision.`,
                    },
                },
                {
                    "@type": "Question",
                    name: "Do you provide installation support?",
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: "Yes, installation, NABL calibration and 24/7 technical support are available.",
                    },
                },
            ],
        }
        : null;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link Copied to clipboard");
        setShowShare(false);
    };

    const handleWhatsapp = () => {
        const shareText = `🔬 ${product?.title}\n\n${product?.desc || ""}\n\n🌐 ${window.location.href}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
    };

    const handleFacebook = () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, "_blank");
    };

    const handleInstagram = async () => {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied for Instagram sharing.");
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            await navigator.share({
                title: product.title,
                text: product.desc,
                url: window.location.href,
            });
        } else {
            setShowShare(!showShare);
        }
    };

    useEffect(() => {
        const close = (e) => {
            if (shareRef.current && !shareRef.current.contains(e.target)) {
                setShowShare(false);
            }
        };

        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    if (loading) {
        return (
            <section className="py-12 md:py-20 bg-slate-50">
                <div className="container-custom">
                    <div className="grid lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-5 space-y-6">
                            <div className="h-[420px] rounded-3xl bg-slate-200 animate-pulse" />
                            <div className="h-[300px] rounded-3xl bg-slate-200 animate-pulse" />
                        </div>
                        <div className="lg:col-span-7 space-y-6">
                            <div className="h-10 w-2/3 bg-slate-200 rounded-xl animate-pulse" />
                            <div className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
                            <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    if (!product) {
        return (
            <section className="py-20 bg-slate-50 text-center">
                <div className="container-custom max-w-xl">
                    <div className="rounded-3xl border border-slate-200 bg-white p-12 shadow-sm">
                        <Microscope size={48} className="mx-auto text-slate-400 mb-4" />
                        <h2 className="text-2xl font-bold text-slate-900">Instrument Record Not Found</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            The requested product might have been updated or moved. Please explore our equipment catalog or contact our engineering team.
                        </p>
                        <a
                            href="/items"
                            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold !text-white shadow-sm"
                        >
                            Browse Equipment Catalog
                        </a>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="py-8 md:py-16 bg-slate-50 text-slate-900">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(productSchema),
                }}
            />

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(faqSchema),
                }}
            />

            <div className="container-custom">
                {/* Breadcrumbs */}
                <div className="mb-6 flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-500">
                    <a href="/" className="hover:text-slate-900 transition-colors">Home</a>
                    <span>/</span>
                    <a href="/items" className="hover:text-slate-900 transition-colors">Products</a>
                    <span>/</span>
                    <span className="text-slate-900 font-bold truncate max-w-xs sm:max-w-md">{product.title}</span>
                </div>

                {/* ================= COMPACT UNIFIED TOP SECTION (NO VERTICAL GAP) ================= */}
                <div className="grid lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT COLUMN: Product Gallery + Quick Quote Form Directly Attached (ZERO GAP) */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* Product Image Frame */}
                        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white shadow-xs">
                                <ShieldCheck size={13} className="text-emerald-400" />
                                <span>Certified Medical Grade</span>
                            </div>

                            <div className="relative h-[320px] sm:h-[380px] w-full mt-4 flex items-center justify-center">
                                {selectedMedia === "video" && product.video ? (
                                    <video
                                        controls
                                        autoPlay
                                        className="h-full w-full object-contain p-2"
                                    >
                                        <source src={product.video} type="video/mp4" />
                                    </video>
                                ) : (
                                    <>
                                        {!imageLoaded && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 animate-pulse rounded-2xl">
                                                <div className="h-12 w-12 rounded-full border-4 border-slate-300 border-t-slate-900 animate-spin" />
                                            </div>
                                        )}

                                        {(selectedImage || product.image || (Array.isArray(product.images) && product.images[0])) && (selectedImage || product.image) !== "/logo.png" ? (
                                            <Image
                                                src={selectedImage || product.image || (Array.isArray(product.images) && product.images[0])}
                                                alt={product.title || "Product"}
                                                fill
                                                priority
                                                onLoad={() => setImageLoaded(true)}
                                                className="object-contain p-2 transition-all duration-300 hover:scale-105"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 shadow-sm">
                                                    <Microscope size={32} />
                                                </div>
                                                <span className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-900">
                                                    {product.category || "Biomedical Analyzer"}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Thumbnail Selector Bar */}
                            <div className="mt-4 flex flex-wrap gap-2.5 pt-4 border-t border-slate-100">
                                {((Array.isArray(product.images) && product.images.length > 0)
                                    ? product.images
                                    : [product.image || selectedImage]
                                ).filter((img) => img && img !== "/logo.png").map((img, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            setSelectedImage(img);
                                            setSelectedMedia("image");
                                        }}
                                        className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 transition-all ${
                                            selectedMedia === "image" && selectedImage === img
                                                ? "border-slate-900 shadow-sm"
                                                : "border-slate-200 bg-slate-50 hover:border-slate-400"
                                        }`}
                                    >
                                        <Image
                                            src={img}
                                            alt={`Thumbnail ${index + 1}`}
                                            width={64}
                                            height={64}
                                            className="h-full w-full object-contain p-1"
                                        />
                                    </button>
                                ))}

                                {product.video && (
                                    <button
                                        onClick={() => setSelectedMedia("video")}
                                        className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl border-2 transition-all ${
                                            selectedMedia === "video"
                                                ? "border-slate-900 bg-slate-100 shadow-sm"
                                                : "border-slate-200 bg-slate-50 hover:border-slate-400"
                                        }`}
                                    >
                                        <FaPlay size={16} className="text-emerald-600" />
                                        <span className="mt-1 text-[10px] font-bold text-slate-800">Video</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Direct Quote Enquiry Form (Immediately attached with minimal gap) */}
                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
                                <div>
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                                        Instant Procurement Inquiry
                                    </span>
                                    <h3 className="text-lg font-black text-slate-900">
                                        Request Official Quote
                                    </h3>
                                </div>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                                    2-Hour SLA
                                </span>
                            </div>

                            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                                        Contact Name *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Dr. / Purchase Manager Name"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                                        Official Email *
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="name@hospital.com"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                                        Phone / WhatsApp *
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="10-digit mobile number"
                                        maxLength={10}
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold !text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-70 mt-3"
                                >
                                    <Send size={15} className="!text-white text-white" />
                                    <span className="!text-white text-white font-bold">
                                        {submitting ? "Sending..." : "Submit Price & Specs Inquiry"}
                                    </span>
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Product Header, Description, Action Buttons & Unified Specifications (NO DUPLICATION) */}
                    <div className="lg:col-span-7 space-y-6">
                        
                        {/* Title & Actions Card */}
                        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-800">
                                    {product.subCategory && product.subCategory !== product.category
                                        ? `${product.category} • ${product.subCategory}`
                                        : product.category || "Biomedical Equipment"}
                                </span>

                                {/* Share Tool */}
                                <div ref={shareRef} className="relative">
                                    <button
                                        onClick={handleNativeShare}
                                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 shadow-xs transition-all hover:bg-slate-100 hover:text-slate-900"
                                        title="Share Product"
                                    >
                                        <FaShareAlt size={15} />
                                    </button>

                                    {showShare && (
                                        <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                                            <button
                                                onClick={handleCopy}
                                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                            >
                                                <FaLink /> Copy Direct Link
                                            </button>
                                            <button
                                                onClick={handleWhatsapp}
                                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                            >
                                                <FaWhatsapp className="text-emerald-600" /> WhatsApp
                                            </button>
                                            <button
                                                onClick={handleFacebook}
                                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                            >
                                                <FaFacebook className="text-blue-600" /> Facebook
                                            </button>
                                            <button
                                                onClick={handleInstagram}
                                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                            >
                                                <FaInstagram className="text-pink-600" /> Instagram
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h1 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 leading-tight">
                                {product.title}
                            </h1>

                            {/* Brochure & PDF Action Button */}
                            <div className="mt-5 flex flex-wrap gap-3">
                                <button
                                    onClick={handleDownloadBrochure}
                                    disabled={downloadingBrochure}
                                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs sm:text-sm font-bold !text-white shadow-xs transition-all hover:bg-slate-800 disabled:opacity-75"
                                >
                                    <Download size={16} className="!text-white text-white" />
                                    <span className="!text-white text-white font-bold">
                                        {downloadingBrochure ? "Preparing PDF..." : "Download Official Brochure"}
                                    </span>
                                </button>

                                {product.pdf && (
                                    <a
                                        href={product.pdf}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 transition-all hover:bg-slate-100"
                                    >
                                        <span>View Manufacturer Spec Sheet (PDF)</span>
                                    </a>
                                )}
                            </div>

                            {/* Product Description */}
                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                                    Clinical Description & Overview
                                </h3>
                                <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                                    {product.desc || product.description || "High precision diagnostic instrument engineered for clinical accuracy, compliant with NABL calibration standards."}
                                </p>
                            </div>
                        </div>

                        {/* SINGLE UNIFIED TECHNICAL SPECIFICATIONS TABLE (Appears ONCE) */}
                        {specificationsList.length > 0 && (
                            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                                    <div>
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                                            Equipment Parameters
                                        </span>
                                        <h3 className="text-xl font-bold text-slate-900">
                                            Technical Specifications
                                        </h3>
                                    </div>
                                    <Award size={22} className="text-slate-800" />
                                </div>

                                <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                                    <table className="w-full border-collapse text-left">
                                        <tbody>
                                            {specificationsList.map((item, index) => (
                                                <tr
                                                    key={index}
                                                    className="border-b border-slate-100 last:border-b-0 transition hover:bg-slate-50/80"
                                                >
                                                    <td className="w-2/5 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 border-r border-slate-100">
                                                        {item.label}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900">
                                                        {item.value}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ================= SEO CONTENT SECTIONS (100% PRESERVED) ================= */}
                <div className="mt-16 rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm">
                    <div className="border-b border-slate-100 pb-4 mb-8">
                        <span className="inline-flex rounded-full bg-slate-100 px-3.5 py-1 text-xs font-bold uppercase text-slate-800 mb-2">
                            Product Knowledge
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                            Comprehensive Equipment Information & Technical Guide
                        </h2>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {[
                            {
                                title: `Why Choose Raj Biosis in ${cityName}?`,
                                content: `Raj Biosis Private Limited is a trusted supplier and distributor of ${product.title} in ${cityName}. We provide high-quality biomedical and laboratory equipment for hospitals, pathology laboratories, diagnostic centres and healthcare facilities.`,
                            },
                            {
                                title: `Features of ${product.title}`,
                                content: `${product.title} offers reliable performance, accurate results, user-friendly operation, long service life and efficient workflow for laboratories, hospitals and healthcare professionals.`,
                            },
                            {
                                title: `Applications of ${product.title}`,
                                content: `Widely used in hospitals, pathology laboratories, diagnostic centres, blood banks, research institutes and healthcare facilities for accurate and efficient diagnostics.`,
                            },
                            {
                                title: `${product.title} Supplier in ${cityName}`,
                                content: `Raj Biosis supplies ${product.title} in ${cityName} with expert consultation, installation support, technical guidance and dependable after-sales service.`,
                            },
                            {
                                title: `${product.title} Dealer in ${cityName}`,
                                content: `We are a trusted dealer of ${product.title} in ${cityName}, offering premium biomedical equipment, laboratory instruments and diagnostic systems at competitive prices.`,
                            },
                            {
                                title: `${product.title} Distributor in ${cityName}`,
                                content: `Looking for a reliable distributor of ${product.title} in ${cityName}? We provide fast delivery, installation support, maintenance assistance and professional customer service.`,
                            },
                            {
                                title: `Buy ${product.title} in ${cityName}`,
                                content: `Purchase high-quality ${product.title} in ${cityName} from Raj Biosis with genuine products, competitive pricing and reliable nationwide support.`,
                            },
                            {
                                title: `${product.title} Price in ${cityName}`,
                                content: `The price of ${product.title} depends on the selected model, specifications and configuration. Contact our team for the latest quotation, availability and delivery information.`,
                            },
                        ].map((item, index) => (
                            <div
                                key={index}
                                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition-all hover:border-slate-300 hover:bg-slate-50"
                            >
                                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                                    {item.title}
                                </h3>
                                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                                    {item.content}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ================= FREQUENTLY ASKED QUESTIONS (100% PRESERVED) ================= */}
                <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm">
                    <div className="border-b border-slate-100 pb-4 mb-8">
                        <span className="inline-flex rounded-full bg-slate-100 px-3.5 py-1 text-xs font-bold uppercase text-slate-800 mb-2">
                            Support & FAQs
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                            Frequently Asked Questions
                        </h2>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {[
                            {
                                question: `What is ${product.title} used for in ${cityName}?`,
                                answer: `${product.title} is commonly used in hospitals, pathology laboratories, diagnostic centres and healthcare facilities for accurate diagnostic and laboratory applications.`,
                            },
                            {
                                question: `What is the price of ${product.title} in ${cityName}?`,
                                answer: `The price depends on the model, configuration and specifications. Contact our team for the latest quotation and availability.`,
                            },
                            {
                                question: `Are you an authorized supplier of ${product.title}?`,
                                answer: `Yes. We supply genuine biomedical and laboratory equipment sourced from trusted manufacturers and brands.`,
                            },
                            {
                                question: `Can hospitals in ${cityName} order this product?`,
                                answer: `Yes. Hospitals, pathology laboratories, diagnostic centres, research institutes and healthcare facilities can purchase this product.`,
                            },
                            {
                                question: "Do you provide installation support?",
                                answer: `Yes. Installation guidance, technical assistance and after-sales support are available for eligible products.`,
                            },
                            {
                                question: "Can I request a quotation?",
                                answer: `Absolutely. Simply submit the enquiry form on this page and our team will provide pricing, availability and product details.`,
                            },
                            {
                                question: "Do you provide warranty?",
                                answer: `Warranty coverage depends on the manufacturer and selected product model. Our team will share complete warranty information.`,
                            },
                            {
                                question: "Do you deliver across India?",
                                answer: `Yes. We provide safe packaging and reliable delivery services across India.`,
                            },
                            {
                                question: "How can I contact Raj Biosis Private Limited?",
                                answer: `You can submit the enquiry form on this page or contact our sales team directly for quotations, product information and technical assistance.`,
                            },
                        ].map((item, index) => (
                            <div
                                key={index}
                                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition-all hover:border-slate-300"
                            >
                                <h4 className="text-sm sm:text-base font-bold text-slate-900">
                                    {item.question}
                                </h4>
                                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                                    {item.answer}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}