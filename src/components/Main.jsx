import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { saveAs } from "file-saver";

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

const TEMPLATE_OPTIONS = [
  { id: "1", name: "Template 1", src: "/template.png" },
  { id: "2", name: "Template 2", src: "/template2.png" },
];

const Main = () => {
  const posterCanvasRef = useRef(null);
  const exportCanvasRef = useRef(null);
  const photoLayerRef = useRef(null);

  const templateImageRef = useRef(null);
  const userPhotoImageRef = useRef(null);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const activePointerIdRef = useRef(null);

  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const assetCacheBust = encodeURIComponent(useId());
  const withAssetVersion = useCallback(
    (url) => {
      if (!url) return url;
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}v=${assetCacheBust}`;
    },
    [assetCacheBust],
  );
  const [fileInputKey, setFileInputKey] = useState(0);

  const [templateSrc, setTemplateSrc] = useState(TEMPLATE_OPTIONS[0].src);

  const [templateSize, setTemplateSize] = useState({
    width: 1080,
    height: 1080,
  });
  const [userPhoto, setUserPhoto] = useState(null);

  const [photoTransform, setPhotoTransform] = useState({
    scale: 1,
    x: 0,
    y: 0,
    rotation: 0,
  });

  const [frameConfig, setFrameConfig] = useState({
    x: 0,
    y: 0,
    w: 800,
    h: 600,
    shape: "rect",
  });

  const clampTranslation = (x, y, scale, rotationDeg) => {
    const el = photoLayerRef.current;
    if (!el) return { x, y };
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (!w || !h) return { x, y };

    const theta = (rotationDeg * Math.PI) / 180;
    const cos = Math.abs(Math.cos(theta));
    const sin = Math.abs(Math.sin(theta));
    const scaledW = w * scale;
    const scaledH = h * scale;
    const bboxW = scaledW * cos + scaledH * sin;
    const bboxH = scaledW * sin + scaledH * cos;

    const maxX = Math.max(0, (bboxW - w) / 2);
    const maxY = Math.max(0, (bboxH - h) / 2);

    return {
      x: clamp(x, -maxX, maxX),
      y: clamp(y, -maxY, maxY),
    };
  };

  useEffect(() => {
    let cancelled = false;

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      templateImageRef.current = img;
      setTemplateSize({ width: img.width, height: img.height });
      setTemplateLoaded(true);
      setFrameConfig((prev) => ({
        ...prev,
        x: 0,
        y: 0,
        w: Math.max(1, img.width),
        h: Math.max(1, img.height),
      }));
      requestAnimationFrame(() => {
        setPhotoTransform((prev) => {
          const clamped = clampTranslation(
            prev.x,
            prev.y,
            prev.scale,
            prev.rotation,
          );
          return { ...prev, x: clamped.x, y: clamped.y };
        });
      });
    };
    img.onerror = () => {
      if (cancelled) return;
      setTemplateLoaded(false);
    };
    img.src = withAssetVersion(templateSrc);

    return () => {
      cancelled = true;
    };
  }, [templateSrc, withAssetVersion]);

  useEffect(() => {
    function onPointerMove(e) {
      if (!isDraggingRef.current) return;
      if (activePointerIdRef.current == null) return;
      if (e.pointerId !== activePointerIdRef.current) return;

      const nextX = e.clientX - dragStartRef.current.x;
      const nextY = e.clientY - dragStartRef.current.y;

      setPhotoTransform((prev) => {
        const clamped = clampTranslation(
          nextX,
          nextY,
          prev.scale,
          prev.rotation,
        );
        return { ...prev, x: clamped.x, y: clamped.y };
      });
    }

    function onPointerUp(e) {
      if (activePointerIdRef.current == null) return;
      if (e.pointerId !== activePointerIdRef.current) return;

      isDraggingRef.current = false;
      activePointerIdRef.current = null;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  const onPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type?.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = String(event.target.result);
      setUserPhoto(dataUrl);
      setPhotoLoaded(true);
      setPhotoTransform({ scale: 1, x: 0, y: 0, rotation: 0 });

      const img = new Image();
      img.onload = () => {
        userPhotoImageRef.current = img;
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);

    if (e.target) e.target.value = "";
    setFileInputKey((k) => k + 1);
  };

  const handlePhotoPointerDown = (e) => {
    if (!userPhoto) return;
    isDraggingRef.current = true;
    activePointerIdRef.current = e.pointerId;

    if (typeof e.currentTarget?.setPointerCapture === "function") {
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    dragStartRef.current = {
      x: e.clientX - photoTransform.x,
      y: e.clientY - photoTransform.y,
    };
  };

  const resetPhoto = () => {
    setPhotoTransform({ scale: 1, x: 0, y: 0, rotation: 0 });
  };
  const zoomMin = 1;
  const zoomMax = 3;
  const zoomStep = 0.1;

  const rotationMin = -180;
  const rotationMax = 180;
  const rotationStep = 5;

  const changeZoom = (delta) => {
    setPhotoTransform((prev) => {
      const nextScale = clamp(
        Number((prev.scale + delta).toFixed(2)),
        zoomMin,
        zoomMax,
      );
      const clamped = clampTranslation(
        prev.x,
        prev.y,
        nextScale,
        prev.rotation,
      );
      return { ...prev, scale: nextScale, x: clamped.x, y: clamped.y };
    });
  };

  const changeRotation = (delta) => {
    setPhotoTransform((prev) => {
      const nextRotation = clamp(
        prev.rotation + delta,
        rotationMin,
        rotationMax,
      );
      const clamped = clampTranslation(
        prev.x,
        prev.y,
        prev.scale,
        nextRotation,
      );
      return { ...prev, rotation: nextRotation, x: clamped.x, y: clamped.y };
    });
  };

  const exportPoster = async (format) => {
    if (!templateImageRef.current) {
      alert("টেমপ্লেট এখনো লোড হয়নি!");
      return;
    }

    const canvas = exportCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = templateSize.width;
    canvas.height = templateSize.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (format === "jpg") {
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    const img = userPhotoImageRef.current;
    if (userPhoto && img) {
      ctx.save();
      const { x, y, w, h, shape } = frameConfig;
      ctx.beginPath();
      if (shape === "circle") {
        const radius = Math.min(w, h) / 2;
        ctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.clip();
      const coverScale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const scale = coverScale * photoTransform.scale;
      const imgWidth = img.naturalWidth * scale;
      const imgHeight = img.naturalHeight * scale;

      const centerX = x + w / 2;
      const centerY = y + h / 2;

      ctx.translate(centerX + photoTransform.x, centerY + photoTransform.y);
      ctx.rotate((photoTransform.rotation * Math.PI) / 180);
      ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);

      ctx.restore();
    }
    ctx.drawImage(
      templateImageRef.current,
      0,
      0,
      templateSize.width,
      templateSize.height,
    );

    const mimeType = format === "jpg" ? "image/jpeg" : "image/png";

    const filename = `poster-${Date.now()}.${format}`;

    const isIOS = (() => {
      const ua = navigator.userAgent || "";
      const isAppleMobile = /iPad|iPhone|iPod/i.test(ua);
      const isIpadOS =
        navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
      return isAppleMobile || isIpadOS;
    })();

    const dataUrlToBlob = (dataUrl) => {
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex === -1) return new Blob([], { type: mimeType });

      const header = dataUrl.slice(0, commaIndex);
      const base64 = dataUrl.slice(commaIndex + 1);
      const match = header.match(/data:(.*?);base64/i);
      const type = match?.[1] || mimeType;

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type });
    };

    // Synchronous export keeps the "user gesture" context for mobile browsers.
    const dataUrl = canvas.toDataURL(mimeType, 0.95);
    const blob = dataUrlToBlob(dataUrl);

    // 1) Best mobile experience: Share sheet (Save Image, Files, etc.)
    try {
      if (navigator.share && typeof File === "function") {
        const file = new File([blob], filename, { type: mimeType });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Poster" });
          return;
        }
      }
    } catch {
      // Ignore; fall through to download fallback.
    }

    // 2) Standard download (works well on Android/desktop)
    try {
      saveAs(blob, filename);
      return;
    } catch {
      // Ignore; fall through.
    }

    // 3) iOS fallback: open image so user can long-press "Save Image"
    if (isIOS) {
      const opened = window.open(dataUrl, "_blank", "noopener,noreferrer");
      if (!opened) window.location.href = dataUrl;
      return;
    }

    // 4) Last resort: download attribute
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const posterAspectRatio = `${templateSize.width}/${templateSize.height}`;
  const frameLeftPct = (frameConfig.x / templateSize.width) * 100;
  const frameTopPct = (frameConfig.y / templateSize.height) * 100;
  const frameWidthPct = (frameConfig.w / templateSize.width) * 100;
  const frameHeightPct = (frameConfig.h / templateSize.height) * 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4 sm:gap-6 lg:gap-8 items-start">
      {/* Preview */}
      <div className="bg-white/95 p-4 sm:p-6 rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="bg-gray-100 rounded-[15px] p-4 sm:p-6 flex items-center justify-center min-h-[360px] sm:min-h-[520px]">
          <div className="w-full max-w-[600px] mx-auto">
            <div
              ref={posterCanvasRef}
              style={{
                width: "100%",
                aspectRatio: posterAspectRatio,
                position: "relative",
                overflow: "hidden",
                borderRadius: 12,
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                background: "#e5e7eb",
              }}
            >
              {!templateLoaded && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center px-6">
                  টেমপ্লেট লোড হচ্ছে...
                </div>
              )}

              {/* Photo layer */}
              {templateLoaded && userPhoto && (
                <div
                  className="photo-layer"
                  onPointerDown={handlePhotoPointerDown}
                  ref={photoLayerRef}
                  style={{
                    position: "absolute",
                    left: `${frameLeftPct}%`,
                    top: `${frameTopPct}%`,
                    width: `${frameWidthPct}%`,
                    height: `${frameHeightPct}%`,
                    borderRadius: frameConfig.shape === "circle" ? "50%" : 8,
                    overflow: "hidden",
                    cursor: "grab",
                    userSelect: "none",
                    zIndex: 10,
                    touchAction: "none",
                  }}
                >
                  <img
                    alt="user"
                    src={userPhoto}
                    draggable={false}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: `translate(${photoTransform.x}px, ${photoTransform.y}px) scale(${photoTransform.scale}) rotate(${photoTransform.rotation}deg)`,
                      transformOrigin: "center",
                      willChange: "transform",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              )}

              {/* Template overlay */}
              {templateLoaded && (
                <img
                  alt="template"
                  src={withAssetVersion(templateSrc)}
                  draggable={false}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none",
                    zIndex: 999,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Hidden export canvas */}
        <canvas ref={exportCanvasRef} style={{ display: "none" }} />
      </div>

      {/* Controls */}
      <div className="bg-white/95 p-4 sm:p-6 rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        {/* Template picker */}
        <div className="mb-6">
          <div className="block text-[#4b5563] font-semibold mb-2 text-lg">
            টেমপ্লেট নির্বাচন করুন
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {TEMPLATE_OPTIONS.map((t) => {
              const selected = t.src === templateSrc;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTemplateLoaded(false);
                    setTemplateSrc(t.src);
                  }}
                  className={`shrink-0 rounded-2xl border-2 transition-all bg-white overflow-hidden ${
                    selected
                      ? "border-indigo-600 shadow-[0_10px_25px_rgba(79,70,229,0.25)]"
                      : "border-black/10 hover:border-indigo-300"
                  }`}
                  style={{ width: 92 }}
                  aria-label={t.name}
                >
                  <div className="aspect-square bg-gray-100">
                    <img
                      src={withAssetVersion(t.src)}
                      alt={t.name}
                      className="w-full h-full object-cover"
                      draggable={false}
                      loading="lazy"
                    />
                  </div>
                  <div className="text-xs text-gray-600 py-2 px-2 truncate">
                    {t.name}
                  </div>
                </button>
              );
            })}
          </div>
          {!templateLoaded && (
            <div className="mt-2 text-sm text-gray-500">
              (টেমপ্লেট লোড হচ্ছে, একটু অপেক্ষা করুন)
            </div>
          )}
        </div>

        {/* Photo upload */}
        <div className="mb-6 relative z-10">
          <label className="block text-[#4b5563] font-semibold mb-2 text-lg">
            আপনার ছবি আপলোড করুন
          </label>
          <input
            key={fileInputKey}
            type="file"
            accept="image/*"
            onChange={onPhotoChange}
            disabled={!templateLoaded}
            className={`file-input text-black/70 px-3 py-2 rounded-xl w-full text-sm sm:text-base ${
              templateLoaded ? "bg-gray-100" : "bg-gray-200 cursor-not-allowed"
            }`}
          />
        </div>

        {/* Photo controls */}
        {templateLoaded && photoLoaded && (
          <div>
            <div className="control-group">
              <div className="control-label">
                <span className="text-black">জুম (Zoom)</span>
                <span className="control-value">
                  {photoTransform.scale.toFixed(2)}x
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-3 sm:py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 active:scale-[0.98]"
                  onClick={() => changeZoom(-zoomStep)}
                  aria-label="Zoom out"
                >
                  -
                </button>
                <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{
                      width: `${
                        ((photoTransform.scale - zoomMin) /
                          (zoomMax - zoomMin)) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="px-4 py-3 sm:py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 active:scale-[0.98]"
                  onClick={() => changeZoom(zoomStep)}
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
            </div>

            <div className="control-group">
              <div className="control-label">
                <span className="text-black">ঘোরানো (Rotation)</span>
                <span className="control-value">
                  {photoTransform.rotation}°
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-3 sm:py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 active:scale-[0.98]"
                  onClick={() => changeRotation(-rotationStep)}
                  aria-label="Rotate left"
                >
                  -
                </button>
                <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{
                      width: `${
                        ((photoTransform.rotation - rotationMin) /
                          (rotationMax - rotationMin)) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="px-4 py-3 sm:py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 active:scale-[0.98]"
                  onClick={() => changeRotation(rotationStep)}
                  aria-label="Rotate right"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-reset"
              onClick={resetPhoto}
            >
              <span>🔄</span>
              <span>রিসেট করুন</span>
            </button>

            <div className="mt-6">
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  className="btn bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                  onClick={() => exportPoster("png")}
                >
                  <span>⬇️</span>
                  <span>PNG ডাউনলোড করুন</span>
                </button>
                <button
                  type="button"
                  className="btn bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700"
                  onClick={() => exportPoster("jpg")}
                >
                  <span>⬇️</span>
                  <span>JPG ডাউনলোড করুন</span>
                </button>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              টিপস: ছবির উপর ক্লিক করে ড্র্যাগ করুন।
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Main;
