import React, { useMemo, useState } from "react";

const APP_URL = "https://election-profile.vercel.app/";

function detectInAppBrowser(userAgent) {
  const ua = userAgent || "";

  // Common in-app browser markers (FB/IG/Messenger etc.)
  const socialIAB =
    /(FBAN|FBAV|FB_IAB|Messenger|Instagram|Line|Twitter|Snapchat|Pinterest|LinkedInApp)/i;

  // Android WebView marker often used by in-app browsers
  const androidWV = /\bwv\b/i.test(ua) && /Android/i.test(ua);

  return socialIAB.test(ua) || androidWV;
}

const Header = () => {
  const [copied, setCopied] = useState(false);
  const isInApp = useMemo(() => detectInAppBrowser(navigator.userAgent), []);

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(APP_URL);
      } else {
        window.prompt("Copy this link:", APP_URL);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link:", APP_URL);
    }
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ url: APP_URL, title: "Election Profile" });
        return;
      }
    } catch {
      // ignore
    }
    await copyLink();
  };

  const openInBrowser = () => {
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);

    // Best-effort: Android can sometimes jump to Chrome via intent:// from in-app browsers.
    if (isAndroid) {
      try {
        const u = new URL(APP_URL);
        const intentUrl = `intent://${u.host}${u.pathname}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(APP_URL)};end`;
        window.location.href = intentUrl;
        return;
      } catch {
        // ignore
      }
    }

    // iOS and many in-app browsers won't allow forcing external apps.
    // Opening a new tab is still useful in some cases.
    window.open(APP_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="text-center mb-12 p-8 bg-white/10 backdrop-blur-lg rounded-2xl">
      {isInApp && (
        <div className="mb-5 mx-auto max-w-2xl rounded-2xl border border-amber-300/60 bg-amber-50/95 p-4 text-left shadow-sm">
          <div className="text-amber-900 font-semibold">
            আপনি Messenger/Facebook/Instagram এর in-app browser এ আছেন
          </div>
          <div className="text-amber-800 text-sm mt-1">
            এখানে অনেক সময় Image Download/Save ঠিকভাবে কাজ করে না। নিচের বাটন
            দিয়ে লিংকটা আপনার মোবাইল ব্রাউজারে ওপেন করুন।
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openInBrowser}
              className="px-3 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
            >
              Open in Browser
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="px-3 py-2 rounded-xl bg-white text-amber-900 text-sm font-semibold border border-amber-300 hover:bg-amber-50"
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
          <div className="mt-3 text-xs text-amber-700">
            Tip: In-app browser menu (⋮/… ) থেকে “Open in browser” দিলেও হবে।
          </div>
        </div>
      )}

      <h1 className="text-5xl font-extrabold mb-2 drop-shadow-lg">
        📸 পোস্টার তৈরি করুন
      </h1>
      <p className="text-lg opacity-90">আপনার ছবি দিয়ে সুন্দর পোস্টার বানান</p>
    </div>
  );
};

export default Header;
