import styles from "../styles/matrix.module.css";


function SingleOptionTable({ product, quantities, setQuantities }) {
    // Simple Enter Key logic for vertical list
    const handleKeyDown = (e, index) => {
        let nextIndex = null;

        // 1. Determine direction
        if (e.key === "ArrowUp") {
            nextIndex = index - 1;
        } else if (e.key === "ArrowDown" || e.key === "Enter") {
            nextIndex = index + 1;
        } else {
            return; // Stop if it's not a navigation key
        }

        // 2. Prevent default scrolling/cursor movement
        e.preventDefault();

        // 3. Find and focus the next input
        const nextInput = document.querySelector(`input[data-index="${nextIndex}"]`);
        if (nextInput) {
            nextInput.focus();
            nextInput.select(); // Highlights the text so you can overwrite immediately
        }
    };

    const handlePaste = (e, startIndex) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData("text").split(/\r?\n/);
        setQuantities(prev => {
            const next = { ...prev };
            pasteData.forEach((val, i) => {
                const targetIndex = startIndex + i;
                if (targetIndex >= product.variants.edges.length) return;
                const variantId = product.variants.edges[targetIndex].node.id;
                const num = parseInt(val.trim());
                if (!isNaN(num) && num >= 0) next[variantId] = num;
            });
            return next;
        });
    };

    return (
        <table className={styles.listTable}>
            <thead>
                <tr>
                    <th>Variant</th>
                    <th>Price</th>
                    <th>Available</th>
                    <th style={{ width: "100px", textAlign: "center" }}>Qty</th>
                </tr>
            </thead>
            <tbody>
                {product.variants.edges.map((edge, index) => {
                    const v = edge.node;
                    const stock = v.inventoryQuantity || 0;
                    const qty = quantities[v.id] || "";
                    const isOver = qty > stock && stock > 0;
                    const isOut = stock <= 0;

                    return (
                        <tr key={v.id}>
                            <td>
                                <span style={{ fontWeight: "600" }}>{v.title}</span>
                            </td>
                            <td>${v.price}</td>
                            <td>
                                <span style={{ color: isOut ? "#d82c0d" : "#616161" }}>{isOut ? "Out of Stock" : stock}</span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                                {stock > 0 ? (
                                    <input
                                        type="number" min="0" placeholder="0"
                                        className={styles.qtyInput}
                                        data-index={index}
                                        value={qty}
                                        onKeyDown={(e) => handleKeyDown(e, index)}
                                        style={{ borderColor: isOver ? '#d82c0d' : undefined, backgroundColor: isOver ? '#fff4f4' : undefined }}
                                        onChange={(e) => {
                                            const val = e.target.value ? parseInt(e.target.value) : undefined;
                                            setQuantities(p => val ? ({ ...p, [v.id]: val }) : (delete p[v.id], { ...p }));
                                        }}
                                        onPaste={(e) => handlePaste(e, index)} // <--- ADDED
                                    />
                                ) : <span style={{ color: "#ccc" }}>—</span>}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

export default SingleOptionTable;