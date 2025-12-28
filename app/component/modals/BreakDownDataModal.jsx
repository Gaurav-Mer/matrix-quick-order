import { useEffect } from "react";
import {
    Text, Button
} from "@shopify/polaris";
import { X } from "lucide-react"; // Added Clock, ExternalLink
import styles from "../../styles/matrix.module.css"


function BreakDownDataModal({ open, onClose, summary }) {
    useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
    return (
        <div className={`${styles.modalBackdrop} ${open ? styles.open : ''}`} onClick={onClose}>
            <div className={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><Text variant="headingMd" as="h3">Order Summary</Text></div>
                    <div style={{ cursor: "pointer", padding: "4px" }} onClick={onClose}><X size={20} color="#5c5f62" /></div>
                </div>
                <div className={styles.modalBody}>
                    <div style={{ marginBottom: "20px", textAlign: "center" }}>
                        <Text tone="subdued">Subtotal</Text>
                        <Text variant="headingLg" as="h3">${summary.subtotalPrice}</Text>
                        {parseFloat(summary.discountAmount) > 0 && (
                            <div style={{ margin: "10px 0", color: "#d82c0d", fontWeight: "bold" }}>- ${summary.discountAmount} Discount</div>
                        )}
                        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #ccc" }}>
                            <Text variant="heading2xl" as="h2">${summary.finalTotalPrice}</Text>
                            <Text tone="subdued">{summary.totalItems} Items</Text>
                        </div>
                    </div>
                    <div style={{ border: "1px solid #e1e3e5", borderRadius: "8px", overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                            <thead style={{ backgroundColor: "#f7f8f9", borderBottom: "1px solid #e1e3e5", color: "#444" }}><tr><th style={{ padding: "10px", textAlign: "left" }}>Item</th><th style={{ padding: "10px", textAlign: "center" }}>Qty</th><th style={{ padding: "10px", textAlign: "right" }}>Total</th></tr></thead>
                            <tbody>{summary.lines.map((l, i) => <tr key={i} style={{ borderBottom: i < summary.lines.length - 1 ? "1px solid #f1f2f3" : "none" }}><td style={{ padding: "10px" }}><div style={{ fontWeight: "500" }}>{l.title}</div><div style={{ fontSize: "12px", color: "#888" }}>${l.unitPrice} each</div></td><td style={{ padding: "10px", textAlign: "center" }}><span style={{ background: "#eee", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>{l.quantity}</span></td><td style={{ padding: "10px", textAlign: "right", fontWeight: "600" }}>${l.lineTotal}</td></tr>)}</tbody>
                        </table>
                    </div>
                </div>
                <div className={styles.modalFooter}><Button onClick={onClose}>Close</Button></div>
            </div>
        </div>
    );
}

export default BreakDownDataModal;