import { useState, useEffect } from "react";
import { Keyboard, X, Copy, Zap, AlertCircle } from "lucide-react";

const TIPS = [
    { icon: <Keyboard size={14} />, text: <span>Use Arrow keys <strong>⬆️ ⬇️ ⬅️ ➡️</strong> to navigate the grid instantly.</span> },
    { icon: <Copy size={14} />, text: <span><strong>Paste (Ctrl+V)</strong> directly from Excel to fill columns automatically! 🚀</span> },
    { icon: <Zap size={14} />, text: <span>Press <strong>Enter</strong> to move down. At the bottom? It jumps to the next column!</span> },
    { icon: <AlertCircle size={14} />, text: <span>We automatically block <strong>Out of Stock</strong> items to prevent backorders.</span> },
];

export function TipBanner() {
    const [isVisible, setIsVisible] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFading, setIsFading] = useState(false);

    // useEffect(() => {
    //     if (!isVisible) return;

    //     const interval = setInterval(() => {
    //         setIsFading(true);
    //         setTimeout(() => {
    //             setCurrentIndex((prev) => (prev + 1) % TIPS.length);
    //             setIsFading(false);
    //         }, 300);
    //     }, 5000);

    //     return () => clearInterval(interval);
    // }, [isVisible]);

    if (!isVisible) return null;

    const currentTip = TIPS[currentIndex];

    return (
        <div style={{
            padding: "10px 20px",
            background: "#e3f1df",          // Light Green Background
            borderBottom: "1px solid #b7eb8f", // Green Border
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            color: "#007a5c",               // Dark Green Text
            fontSize: "12px",
            fontWeight: "600",
            height: "40px",
            overflow: "hidden"
        }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    opacity: isFading ? 0 : 1,
                    transform: isFading ? "translateY(5px)" : "translateY(0)",
                    transition: "opacity 0.3s ease, transform 0.3s ease",
                    flex: 1
                }}
            >
                {/* Icons are also colored Dark Green */}
                <span style={{ color: "#007a5c", display: "flex", alignItems: "center" }}>
                    {currentTip.icon}
                </span>
                <span style={{ marginTop: "1px" }}>Pro Tip: {currentTip.text}</span>
            </div>

            <button
                onClick={() => setIsVisible(false)}
                style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#007a5c", // Green X button
                    display: "flex",
                    padding: "4px",
                    opacity: 0.7
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "0.7"}
                title="Dismiss Tips"
            >
                <X size={16} />
            </button>
        </div>
    );
}