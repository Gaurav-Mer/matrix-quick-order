import {
    Text
} from "@shopify/polaris";
import { Clock, ExternalLink, RefreshCw } from "lucide-react"; // Added Clock, ExternalLink


function RecentOrders({ orders, onLoad }) { // <--- Receive onLoad prop
    if (!orders || orders.length === 0) return null;

    return (
        <div style={{ marginTop: "20px", marginBottom: "40px" }}>
            <Text variant="headingMd" as="h3">Recent Orders</Text>
            <div style={{ marginTop: "10px", background: "#fff", borderRadius: "12px", border: "1px solid #e1e3e5", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead style={{ background: "#fafafa", borderBottom: "1px solid #e1e3e5", color: "#616161", textAlign: "left" }}>
                        <tr>
                            <th style={{ padding: "12px 20px" }}>Order</th>
                            <th style={{ padding: "12px 20px" }}>Customer</th>
                            <th style={{ padding: "12px 20px" }}>Time</th>
                            <th style={{ padding: "12px 20px", textAlign: "right" }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map((order, i) => (
                            <tr key={i} style={{ borderBottom: i < orders.length - 1 ? "1px solid #f1f2f3" : "none" }}>
                                <td style={{ padding: "12px 20px", fontWeight: "600" }}>{order.name}</td>
                                <td style={{ padding: "12px 20px" }}>{order.customer || "No Customer"}</td>
                                <td style={{ padding: "12px 20px", color: "#888" }}>
                                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                        <Clock size={12} />
                                        {new Date(order.createdAt).toLocaleString([], {
                                            month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
                                        })}
                                    </div>
                                </td>
                                <td style={{ padding: "12px 20px", textAlign: "right" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px" }}>
                                        {/* --- NEW: LOAD BUTTON --- */}
                                        <button
                                            onClick={() => onLoad(order)}
                                            style={{
                                                background: "none", border: "none", cursor: "pointer",
                                                color: "#2c6ecb", fontWeight: "600", fontSize: "12px",
                                                display: "flex", alignItems: "center", gap: "4px"
                                            }}
                                        >
                                            <RefreshCw size={12} /> Repeat
                                        </button>

                                        <a href={order.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "#616161", fontWeight: "500", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                            View <ExternalLink size={12} />
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


export default RecentOrders