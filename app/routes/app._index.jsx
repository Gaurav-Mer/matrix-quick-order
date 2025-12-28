import { useMemo, useState, useEffect } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData, useNavigation } from "@remix-run/react";
import {
  Page, Layout, Card, Text, Banner, Button, Spinner,
  Image
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useAppBridge } from "@shopify/app-bridge-react";
import SelectProductForMatrix from "../component/SelectProductForMatrix";
import { Paintbrush, Ruler, AlertCircle, X, FileText, Keyboard } from "lucide-react"; // Added Clock, ExternalLink
import styles from "../styles/matrix.module.css";
import RecentOrders from "../component/RecentOrders";
import SingleOptionTable from "../component/SingleOptionTable";
import CustomerSearchModal from "../component/modals/CustomerSearchModal";
import BreakDownDataModal from "../component/modals/BreakDownDataModal"
import { TipBanner } from "../component/TipBanner"

export const links = () => [{ rel: "stylesheet", href: styles }];

// ==============================================================================
// 1. BACKEND: LOADER
// ==============================================================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);

  const productId = url.searchParams.get("productId");
  const customerQuery = url.searchParams.get("customerQuery");

  // --- API 1: SEARCH CUSTOMERS (Early Exit) ---
  if (customerQuery) {
    const response = await admin.graphql(
      `#graphql
      query searchCustomers($query: String!) {
        customers(first: 10, query: $query) {
          edges {
            node { id, firstName, lastName, email }
          }
        }
      }`,
      { variables: { query: `*${customerQuery}*` } }
    );
    const data = await response.json();
    const results = data.data.customers.edges.map(edge => ({
      id: edge.node.id,
      email: edge.node.email,
      displayName: `${edge.node.firstName || ''} ${edge.node.lastName || ''}`.trim() || edge.node.email
    }));
    return json({ searchResults: results });
  }

  // --- API 2: LOAD PRODUCT + RECENT ORDERS ---
  const productGraphql = productId ? `
    product(id: "${productId}") {
      id, title, options { name, values },
      media(first: 10) {
        edges { node { ... on MediaImage { image { id, url, altText } } } }
      },
      variants(first: 50) {
        edges { 
          node { id, price, title, inventoryQuantity, selectedOptions { name, value } } 
        }
      }
    }
  ` : "";

  // We fetch 50 orders to ensure we find enough matches after filtering.
  // We added 'lineItems' to the query so we can inspect what was sold.
  const response = await admin.graphql(
    `#graphql
    query getData {
      ${productGraphql}
      
      draftOrders(first: 50, query: "tag:MatrixApp AND status:OPEN", sortKey: UPDATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            invoiceUrl
            customer { displayName }
            lineItems(first: 20) {
              edges {
                node {
                  product { id }
                  quantity        # <--- NEW: Need quantity
                  variant { id }  # <--- NEW: Need Variant ID
                }
              }
            }
          }
        }
      }
    }`
  );

  const responseJson = await response.json();

  // Extract the raw order nodes from the edges
  let rawOrders = responseJson.data.draftOrders.edges.map(e => e.node);

  // --- FILTER LOGIC ---
  if (productId) {
    // If a product is currently selected, filter the list to show 
    // ONLY orders that contain this specific product.
    rawOrders = rawOrders.filter(order =>
      order.lineItems.edges.some(line => line.node.product?.id === productId)
    );
  }

  // Take the top 5 valid orders and map them to a clean format
  const finalOrders = rawOrders.slice(0, 5).map(node => ({
    id: node.id,
    name: node.name,
    createdAt: node.createdAt,
    url: node.invoiceUrl,
    customer: node.customer ? node.customer.displayName : "Walk-in",
    items: node.lineItems.edges.map(e => ({
      vid: e.node.variant?.id,
      qty: e.node.quantity
    }))
  }));

  // Return both Product (nullable) and the Filtered Recent Orders
  return json({
    product: responseJson.data.product || null,
    recentOrders: finalOrders
  });
};
// ==============================================================================
// 2. BACKEND: ACTION
// ==============================================================================
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const { cartData, customerId, poNumber, note, discount } = JSON.parse(formData.get("jsonPayload"));

  const lineItems = Object.entries(cartData).map(([variantId, quantity]) => ({
    variantId, quantity: parseInt(quantity),
  }));

  if (lineItems.length === 0) return json({ status: "error", message: "Cart is empty" });

  let finalNote = note || "";
  if (poNumber) finalNote = `PO#: ${poNumber}\n${finalNote}`;

  const draftOrderInput = {
    lineItems,
    note: finalNote,
    tags: poNumber ? [`PO_${poNumber}`, "MatrixApp"] : ["MatrixApp"]
  };

  if (discount && discount.value > 0) {
    draftOrderInput.appliedDiscount = {
      description: "Custom Discount",
      value: parseFloat(discount.value),
      valueType: discount.type
    };
  }

  if (customerId) draftOrderInput.customerId = customerId;

  const response = await admin.graphql(
    `#graphql
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder { id, name, invoiceUrl }
        userErrors { field, message }
      }
    }`,
    { variables: { input: draftOrderInput } }
  );

  const responseJson = await response.json();
  if (responseJson.data.draftOrderCreate.userErrors.length > 0) {
    return json({ status: "error", message: responseJson.data.draftOrderCreate.userErrors[0].message });
  }
  return json({ status: "success", order: responseJson.data.draftOrderCreate.draftOrder });
};


// ==============================================================================
// 4. SUB-COMPONENTS: THE TABLES (1D and 2D)
// ==============================================================================



// --- OPTION B: The Existing 2-Option Matrix ---
function MatrixTable({ product, quantities, setQuantities }) {
  const rowOption = product.options[0];
  const colOption = product.options[1];
  const isColor = (n) => /color|colour/i.test(n);
  const swatch = (v) => v.toLowerCase().replace(" ", "");
  const getVar = (r, c) => product.variants.edges.find(e => e.node.selectedOptions.some(o => o.name === rowOption.name && o.value === r) && e.node.selectedOptions.some(o => o.name === colOption.name && o.value === c));

  const handleKeyDown = (e, r, c) => {
    let nextR = r;
    let nextC = c;

    if (e.key === "ArrowUp") nextR = r - 1;
    else if (e.key === "ArrowDown" || e.key === "Enter") nextR = r + 1;
    else if (e.key === "ArrowLeft") nextC = c - 1;
    else if (e.key === "ArrowRight") nextC = c + 1;
    else return; // Ignore other keys

    e.preventDefault();
    const nextInput = document.querySelector(`input[data-row="${nextR}"][data-col="${nextC}"]`);

    // If we found the input, focus it.
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
    else if (e.key === "Enter" || e.key === "ArrowDown") {
      // Special Case: At bottom of column? Wrap to top of next column
      const nextColTop = document.querySelector(`input[data-row="0"][data-col="${c + 1}"]`);
      if (nextColTop) { nextColTop.focus(); nextColTop.select(); }
    }
  };

  // inside MatrixTable function
  const handlePaste = (e, startRow, colIndex) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").split(/\r?\n/);

    setQuantities(prev => {
      const next = { ...prev };
      const rowOption = product.options[0];
      const colOption = product.options[1];

      pasteData.forEach((val, i) => {
        const targetRow = startRow + i;
        // Stop if we go past the bottom of the table
        if (targetRow >= rowOption.values.length) return;

        const rValue = rowOption.values[targetRow];
        const cValue = colOption.values[colIndex];

        // Find the variant ID for this specific cell (Row + i, Col)
        const variantEdge = product.variants.edges.find(edge =>
          edge.node.selectedOptions.some(o => o.name === rowOption.name && o.value === rValue) &&
          edge.node.selectedOptions.some(o => o.name === colOption.name && o.value === cValue)
        );

        if (variantEdge) {
          const num = parseInt(val.trim());
          if (!isNaN(num) && num > 0) {
            next[variantEdge.node.id] = num;
          }
        }
      });
      return next;
    });
  };


  return (
    <table className={styles.matrixTable}>
      <thead>
        <tr className={styles.headerRow}>
          <th className={styles.headerCorner}><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><div style={{ color: '#9ca3af' }}>{isColor(rowOption.name) ? <Paintbrush size={14} /> : <Ruler size={14} />}</div><span>{rowOption.name}</span><span style={{ color: '#e5e7eb' }}>/</span><span>{colOption.name}</span><div style={{ color: '#9ca3af' }}>{isColor(colOption.name) ? <Paintbrush size={14} /> : <Ruler size={14} />}</div></div></th>
          {colOption.values.map(c => <th key={c}><div className={styles.headerContent}>{isColor(colOption.name) && <span className={styles.colorSwatch} style={{ backgroundColor: swatch(c) }} />} {c}</div></th>)}
        </tr>
      </thead>
      <tbody>
        {rowOption.values.map((r, rIdx) => (
          <tr key={r} className={styles.bodyRow}>
            <td style={{ fontWeight: "600", textAlign: "left" }}><div style={{ display: "flex", alignItems: "center" }}>{isColor(rowOption.name) && <span className={styles.colorSwatch} style={{ backgroundColor: swatch(r) }} />} {r}</div></td>
            {colOption.values.map((c, cIdx) => {
              const v = getVar(r, c); if (!v) return <td key={c}><span className={styles.emptyCell}>×</span></td>;
              const vid = v.node.id; const stock = v.node.inventoryQuantity || 0; const qty = quantities[vid] || "";
              const isOver = qty > stock && stock > 0; const isOut = stock <= 0;
              return (
                <td key={c}>
                  <div className={styles.cellWrapper}>
                    <span className={styles.priceTag}>${v.node.price}</span>
                    <input data-row={rIdx} data-col={cIdx}
                      onPaste={(e) => handlePaste(e, rIdx, cIdx)} // <--- Add this
                      onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)} type="number" min="0" placeholder="-" className={styles.qtyInput} style={{ borderColor: isOver ? '#d82c0d' : undefined, backgroundColor: isOver ? '#fff4f4' : undefined }} value={qty} onChange={(e) => { const val = e.target.value ? parseInt(e.target.value) : undefined; setQuantities(p => val ? ({ ...p, [vid]: val }) : (delete p[vid], { ...p })); }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px', color: isOut || isOver ? '#d82c0d' : '#616161' }}><span>{isOut ? "Out" : `${stock}`}</span>{isOver && <AlertCircle marginTop={4} size={10} />}</div>
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ==============================================================================
// 5. MAIN PAGE CONTROLLER
// ==============================================================================
export default function Index() {
  const { product, recentOrders } = useLoaderData();
  const shopify = useAppBridge();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [customer, setCustomer] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  const [note, setNote] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState("FIXED_AMOUNT");

  const isLoading = navigation.state === "submitting";
  const isPageLoading = navigation.state === "loading";

  useEffect(() => {
    console.log("actionData", actionData)
    if (actionData?.status === "success") {
      const orderName = actionData.order.name;
      shopify.toast.show(`Order Created: ${orderName}`);

      // 1. Reset Form
      setQuantities({});
      setNote("");
      setPoNumber("");
      setDiscountValue("");

      // 2. AUTO-REDIRECT LOGIC 🚀
      // Extract numeric ID from "gid://shopify/DraftOrder/123456789"
      const numericId = actionData.order.id.split("/").pop();

      // Navigate to the Shopify Draft Order page
      // 'shopify:admin' works for both Desktop and Mobile app users
      open(`shopify:admin/draft_orders/${numericId}`, "_top");

    } else if (actionData?.status === "error") {
      shopify.toast.show(actionData.message, { isError: true });
    }
  }, [actionData, shopify]);

  const totalQty = useMemo(() => Object.values(quantities).reduce((sum, qty) => sum + qty, 0), [quantities]);

  // ... inside Index component

  const orderSummary = useMemo(() => {
    let items = 0;
    let subtotal = 0;
    let hasOverselling = false; // <--- 1. New Flag
    const lines = [];

    if (!product) return { totalItems: 0, subtotalPrice: "0.00", finalTotalPrice: "0.00", lines: [], hasOverselling: false };

    Object.entries(quantities).forEach(([vid, qty]) => {
      if (qty > 0) {
        const edge = product.variants.edges.find(e => e.node.id === vid);
        if (edge) {
          const unitPrice = parseFloat(edge.node.price);
          const stock = edge.node.inventoryQuantity || 0; // <--- Get Stock

          // 2. Check for Issues
          // Logic: If trying to buy more than stock, mark as error
          if (qty > stock) {
            hasOverselling = true;
          }

          const lineTotal = unitPrice * qty;
          items += qty;
          subtotal += lineTotal;

          const niceTitle = edge.node.selectedOptions.map(o => `${o.name}: ${o.value}`).join(" | ");
          lines.push({ title: niceTitle, quantity: qty, unitPrice: unitPrice.toFixed(2), lineTotal: lineTotal.toFixed(2) });
        }
      }
    });

    // ... Discount Logic (Same as before) ...
    let discountAmount = 0;
    if (discountValue && !isNaN(discountValue)) {
      const val = parseFloat(discountValue);
      if (val > 0) {
        if (discountType === "FIXED_AMOUNT") discountAmount = val;
        else discountAmount = subtotal * (val / 100);
      }
    }
    const finalTotal = Math.max(0, subtotal - discountAmount);

    return {
      totalItems: items,
      subtotalPrice: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      finalTotalPrice: finalTotal.toFixed(2),
      lines: lines,
      hasOverselling: hasOverselling // <--- Return the flag
    };
  }, [quantities, discountValue, discountType, product]);

  const selectProduct = async () => {
    const selected = await shopify.resourcePicker({ type: 'product', multiple: false });
    if (selected) {
      setQuantities({}); setCustomer(null); submit({ productId: selected[0].id }, { method: "GET" });
    }
  };

  const handleCreateOrder = () => {
    if (orderSummary.totalItems === 0) return;
    let discountPayload = null;
    if (discountValue && parseFloat(discountValue) > 0) {
      discountPayload = { value: discountValue, type: discountType };
    }
    const payload = {
      cartData: quantities, customerId: customer ? customer.id : null,
      note: note, poNumber: poNumber, discount: discountPayload
    };
    submit({ jsonPayload: JSON.stringify(payload) }, { method: "POST" });
  };

  const handleLoadOrder = (order) => {
    const newQuantities = {};
    let count = 0;

    // Loop through the saved items from the order
    order.items.forEach(item => {
      if (item.vid && item.qty > 0) {
        // SAFETY CHECK: 
        // Only add quantity if this variant ID actually exists in the current product
        // This prevents errors if loading an order from a different product or deleted variant
        const exists = product.variants.edges.some(e => e.node.id === item.vid);

        if (exists) {
          newQuantities[item.vid] = item.qty;
          count += item.qty;
        }
      }
    });

    if (count > 0) {
      setQuantities(newQuantities);
      shopify.toast.show(`Loaded ${count} items from ${order.name}`);
    } else {
      shopify.toast.show("No matching items found for this product", { isError: true });
    }
  };




  if (isPageLoading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}><Spinner size="large" /></div>;
  if (!product) return <SelectProductForMatrix selectProduct={selectProduct} />;

  // LOGIC TO CHOOSE TABLE TYPE
  const hasOneOption = product.options.length === 1;
  const hasTwoOptions = product.options.length === 2;
  const isCompatible = hasOneOption || hasTwoOptions;

  if (!isCompatible) {
    return (
      <Page title="Matrix Quick Order" primaryAction={{ content: "Change Product", onAction: selectProduct }}>
        <Layout><Layout.Section><Banner tone="warning" title="Incompatible Product"><p>Product <b>"{product.title}"</b> has {product.options.length} options. This app supports 1 or 2 options only.</p><Button onClick={selectProduct}>Select Different Product</Button></Banner></Layout.Section></Layout>
      </Page>
    );
  }

  // --- RENDER MAIN LAYOUT ---
  return (
    <Page title="Matrix Quick Order" primaryAction={{ content: "Change Product", onAction: selectProduct }}>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {/* Header */}
            <div style={{ padding: "20px", borderBottom: "1px solid #e1e3e5" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                  <Image source={product?.media?.edges?.[0]?.node?.image?.url} alt={product?.title} width={80} height={80} />
                  <div><Text as="h2" variant="headingLg">{product.title}</Text><Text tone="subdued" as="p" variant="bodyMd">{product.options.map(o => o.name).join(" / ")}</Text></div>
                </div>
                <div style={{ minWidth: customer ? "280px" : "auto" }}>
                  {customer ? (
                    <div className={styles.airCustomerCard}>
                      <div className={styles.airHeader}><div className={styles.airAvatar}>{customer.displayName?.[0]?.toUpperCase()}</div><button onClick={() => setIsCustomerModalOpen(true)} className={styles.airChangeBtn}>Change</button></div>
                      <div className={styles.airInfo}><Text variant="bodyMd" fontWeight="bold">{customer.displayName}</Text><Text variant="bodySm" tone="subdued">{customer.email}</Text>
                      </div>
                    </div>
                  ) : (<button onClick={() => setIsCustomerModalOpen(true)} className={styles.airAddBtn}>+ Add Customer</button>)}
                </div>
              </div>
            </div>

            {/* SCROLLABLE TABLE AREA */}
            <div className={styles.matrixWrapper}>
              <TipBanner />
              <div className={styles.tableScrollContainer}>
                {hasOneOption ? (
                  <SingleOptionTable product={product} quantities={quantities} setQuantities={setQuantities} />
                ) : (
                  <MatrixTable product={product} quantities={quantities} setQuantities={setQuantities} />
                )}
              </div>

              {/* SHARED FOOTER INPUTS */}
              <div style={{ padding: "20px", background: "white", borderTop: "1px solid #e1e3e5" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "30px" }}>
                  <div style={{ flex: 2, minWidth: "300px", display: "flex", gap: "20px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#303030" }}>PO Number</label>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}><div style={{ position: "absolute", left: "10px", pointerEvents: "none", display: "flex", alignItems: "center" }}><FileText size={16} color="#5c5f62" /></div><input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-5544" autoComplete="off" className={styles.inp} /></div>
                    </div>
                    <div style={{ flex: 1.5 }}><label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#303030" }}>Order Note</label><input type="text" value={note} className={styles.inp} onChange={(e) => setNote(e.target.value)} placeholder="Notes..." autoComplete="off" /></div>
                  </div>
                  <div style={{ flex: 1, minWidth: "220px", borderLeft: "1px dashed #e1e3e5", paddingLeft: "30px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "600", color: "#303030" }}>Apply Discount</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <div style={{ flex: 2 }}><input type="number" className={styles.inp} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0.00" /></div>
                      <div style={{ flex: 1, display: "flex", background: "#fff", border: "1px solid #898f94", borderRadius: "4px", overflow: "hidden" }}>
                        <button onClick={() => setDiscountType("FIXED_AMOUNT")} style={{ flex: 1, border: "none", cursor: "pointer", background: discountType === "FIXED_AMOUNT" ? "#e3f1df" : "white", color: discountType === "FIXED_AMOUNT" ? "#007a5c" : "#616161", fontWeight: "bold" }}>$</button>
                        <div style={{ width: "1px", background: "#ccc" }}></div>
                        <button onClick={() => setDiscountType("PERCENTAGE")} style={{ flex: 1, border: "none", cursor: "pointer", background: discountType === "PERCENTAGE" ? "#e3f1df" : "white", color: discountType === "PERCENTAGE" ? "#007a5c" : "#616161", fontWeight: "bold" }}>%</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STICKY ACTION FOOTER */}
            </div>
            <div className={styles.actionFooter}>
              <div className={styles.totalLabel} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }} >
                <div onClick={() => setIsBreakdownOpen(true)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#616161", textTransform: "uppercase" }}>Total Estimate</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    {parseFloat(orderSummary.discountAmount) > 0 && (<span style={{ fontSize: "16px", color: "#999", textDecoration: "line-through" }}>${orderSummary.subtotalPrice}</span>)}
                    <span style={{ fontSize: "20px", fontWeight: "700" }}>${orderSummary.finalTotalPrice}</span>
                    <span style={{ fontSize: "14px", color: "#6d7175" }}>({orderSummary.totalItems} items)</span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#005bd3", textDecoration: "underline" }}>View Breakdown</span>
                </div>
                {totalQty > 0 && (
                  <div style={{ height: "40px", width: "1px", background: "#e1e3e5" }}></div> // Divider
                )}

                {totalQty > 0 && (
                  <button
                    onClick={() => {
                      setQuantities({}); // <--- The Magic Logic
                      shopify.toast.show("Cart cleared");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#d82c0d", // Red color for destructive action
                      fontSize: "13px",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px"
                    }}
                  >
                    <X size={14} /> Clear
                  </button>
                )}
              </div>
              <Button
                variant="primary"
                onClick={handleCreateOrder}
                loading={isLoading}
                // Disable if: No items selected OR Overselling detected
                disabled={totalQty === 0 || orderSummary.hasOverselling}
                size="large"
                tone={orderSummary.hasOverselling ? "critical" : undefined} // Optional: Turn button red logic if supported or keep primary
                className={orderSummary.hasOverselling && styles.oversellButton}

              >
                {orderSummary.hasOverselling
                  ? "Not Enough Stock"
                  : (customer ? `Create Order for ${customer.displayName}` : "Create Draft Order")
                }
              </Button>
            </div>
            {actionData?.status === "success" && (<div className={styles.airSuccessWrapper}><div className={styles.airSuccessCard}><div className={styles.airSuccessIcon}>✓</div><div className={styles.airSuccessContent}><h4>Order created successfully</h4><p>Draft order <strong>{actionData?.order?.name}</strong> has been created.</p><Button url={actionData?.order?.invoiceUrl} target="_blank" className={styles.airSuccessBtn}>View invoice</Button></div></div></div>)}
          </Card>

          <RecentOrders orders={recentOrders} onLoad={handleLoadOrder} />
        </Layout.Section>
      </Layout>
      <CustomerSearchModal open={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} onSelect={(c) => setCustomer(c)} />
      <BreakDownDataModal open={isBreakdownOpen} onClose={() => setIsBreakdownOpen(false)} summary={orderSummary} />
    </Page>
  );
}