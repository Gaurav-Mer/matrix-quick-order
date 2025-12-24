import { useMemo, useState, useEffect, useCallback } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData, useNavigation, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, Text, Banner, Button, Spinner,
  Modal, Combobox, Listbox, EmptySearchResult, Icon,
  Image
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Paintbrush, Ruler, AlertCircle, X, FileText } from "lucide-react";
import SelectProductForMatrix from "../component/SelectProductForMatrix";

import styles from "../styles/matrix.module.css";

export const links = () => [{ rel: "stylesheet", href: styles }];

// ==============================================================================
// 1. BACKEND: LOADER
// ==============================================================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);

  const productId = url.searchParams.get("productId");
  const customerQuery = url.searchParams.get("customerQuery");

  // --- API 1: SEARCH CUSTOMERS ---
  if (customerQuery) {
    const response = await admin.graphql(
      `#graphql
    query searchCustomers($query: String!) {
      customers(first: 10, query: $query) {
        edges {
          node { 
            id, firstName, lastName, email
          }
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

  // --- API 2: LOAD PRODUCT MATRIX ---
  if (!productId) return json({ product: null });

  const response = await admin.graphql(
    `#graphql
    query getProduct($id: ID!) {
      product(id: $id) {
        id, title, options { name, values },
        media(first: 10) {
          edges { node { ... on MediaImage { image { id, url, altText } } } }
        },
        variants(first: 50) {
          edges { 
            node { id, price, inventoryQuantity, selectedOptions { name, value } } 
          }
        }
      }
    }`,
    { variables: { id: productId } }
  );

  const responseJson = await response.json();
  return json({ product: responseJson.data.product });
};

// ==============================================================================
// 2. BACKEND: ACTION (Handles Global Discount)
// ==============================================================================
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  // 1. Get data from payload
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

  // 2. Apply Global Discount if present
  if (discount && discount.value > 0) {
    draftOrderInput.appliedDiscount = {
      description: "Custom Discount",
      value: parseFloat(discount.value),
      valueType: discount.type // "FIXED_AMOUNT" or "PERCENTAGE"
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
// 3. FRONTEND: COMPONENTS
// ==============================================================================
function CustomerSearchModal({ open, onClose, onSelect }) {
  const fetcher = useFetcher();
  const [value, setValue] = useState("");
  const updateText = useCallback((newValue) => {
    setValue(newValue);
    if (newValue.length > 1) fetcher.load(`?index&customerQuery=${newValue}`);
  }, [fetcher]);

  const options = (fetcher.data?.searchResults || []).map((c) => ({
    value: c.id, label: c.displayName, email: c.email, ...c
  }));

  return (
    <Modal open={open} onClose={onClose} title="Select a Customer" primaryAction={{ content: 'Cancel', onAction: onClose }}>
      <Modal.Section>
        <Combobox activator={<Combobox.TextField prefix={<Icon source={SearchIcon} />} onChange={updateText} label="Search" labelHidden value={value} placeholder="Search..." autoComplete="off" />}>
          {options.length > 0 ? (
            <Listbox onSelect={(id) => { const s = options.find(c => c.id === id); setValue(s.displayName); onSelect(s); onClose(); }}>
              {options.map((o) => <Listbox.Option key={o.value} value={o.value}><div style={{ padding: "6px" }}><Text fontWeight="bold">{o.label}</Text><Text tone="subdued">{o.email}</Text></div></Listbox.Option>)}
            </Listbox>
          ) : null}
        </Combobox>
      </Modal.Section>
    </Modal>
  );
}

function BreakdownModal({ open, onClose, summary }) {
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
              <div style={{ margin: "10px 0", color: "#d82c0d", fontWeight: "bold" }}>
                - ${summary.discountAmount} Discount
              </div>
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

// ==============================================================================
// 4. FRONTEND: MAIN PAGE
// ==============================================================================
export default function Index() {
  const { product } = useLoaderData();
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

  // --- DISCOUNT STATE ---
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState("FIXED_AMOUNT"); // "FIXED_AMOUNT" or "PERCENTAGE"

  const isLoading = navigation.state === "submitting";
  const isPageLoading = navigation.state === "loading";

  useEffect(() => {
    if (actionData?.status === "success") {
      shopify.toast.show(`Order Created: ${actionData.order.name}`);
      setQuantities({});
      setNote("");
      setPoNumber("");
      setDiscountValue("");
    } else if (actionData?.status === "error") {
      shopify.toast.show(actionData.message, { isError: true });
    }
  }, [actionData, shopify]);

  const totalQty = useMemo(() => Object.values(quantities).reduce((sum, qty) => sum + qty, 0), [quantities]);

  // --- CALCULATE TOTALS & SUMMARY ---
  const orderSummary = useMemo(() => {
    let items = 0; let subtotal = 0; const lines = [];
    if (!product) return { totalItems: 0, subtotalPrice: "0.00", finalTotalPrice: "0.00", lines: [] };

    Object.entries(quantities).forEach(([vid, qty]) => {
      if (qty > 0) {
        const edge = product.variants.edges.find(e => e.node.id === vid);
        if (edge) {
          const unitPrice = parseFloat(edge.node.price);
          const lineTotal = unitPrice * qty;
          items += qty; subtotal += lineTotal;
          const niceTitle = edge.node.selectedOptions.map(o => `${o.name}: ${o.value}`).join(" | ");
          lines.push({ title: niceTitle, quantity: qty, unitPrice: unitPrice.toFixed(2), lineTotal: lineTotal.toFixed(2) });
        }
      }
    });

    // --- APPLY DISCOUNT LOGIC ---
    let discountAmount = 0;
    if (discountValue && !isNaN(discountValue)) {
      const val = parseFloat(discountValue);
      if (val > 0) {
        if (discountType === "FIXED_AMOUNT") {
          discountAmount = val;
        } else {
          // Percentage (value / 100 * subtotal)
          discountAmount = subtotal * (val / 100);
        }
      }
    }

    const finalTotal = Math.max(0, subtotal - discountAmount);

    return {
      totalItems: items,
      subtotalPrice: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      finalTotalPrice: finalTotal.toFixed(2),
      lines: lines,
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
      cartData: quantities,
      customerId: customer ? customer.id : null,
      note: note,
      poNumber: poNumber,
      discount: discountPayload
    };
    submit({ jsonPayload: JSON.stringify(payload) }, { method: "POST" });
  };

  const handleKeyDown = (e, currentRow, currentCol) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextInput = document.querySelector(`input[data-row="${currentRow + 1}"][data-col="${currentCol}"]`);
      if (nextInput) { nextInput.focus(); nextInput.select(); }
      else { const nextColTop = document.querySelector(`input[data-row="0"][data-col="${currentCol + 1}"]`); if (nextColTop) { nextColTop.focus(); nextColTop.select(); } }
    }
  };

  if (isPageLoading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}><Spinner size="large" /></div>;
  if (!product) return <SelectProductForMatrix selectProduct={selectProduct} />;

  const rowOption = product.options[0]; const colOption = product.options[1];
  const isColor = (n) => /color|colour/i.test(n);
  const swatch = (v) => v.toLowerCase().replace(" ", "");
  const getVar = (r, c) => product.variants.edges.find(e => e.node.selectedOptions.some(o => o.name === rowOption.name && o.value === r) && e.node.selectedOptions.some(o => o.name === colOption.name && o.value === c));

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
                  <div><Text as="h2" variant="headingLg">{product.title}</Text><Text tone="subdued" as="p" variant="bodyMd">{rowOption.name} x {colOption.name}</Text></div>
                </div>
                <div style={{ minWidth: customer ? "280px" : "auto" }}>
                  {customer ? (
                    <div className={styles.airCustomerCard}>
                      <div className={styles.airHeader}><div className={styles.airAvatar}>{customer.displayName?.[0]?.toUpperCase()}</div><button onClick={() => setIsCustomerModalOpen(true)} className={styles.airChangeBtn}>Change</button></div>
                      <div className={styles.airInfo}><Text variant="bodyMd" fontWeight="bold">{customer.displayName}</Text><Text variant="bodySm" tone="subdued">{customer.email}</Text></div>
                    </div>
                  ) : (<button onClick={() => setIsCustomerModalOpen(true)} className={styles.airAddBtn}>+ Add Customer</button>)}
                </div>
              </div>
            </div>

            {/* Matrix */}
            <div className={styles.matrixWrapper}>
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
                              <input data-row={rIdx} data-col={cIdx} onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)} type="number" min="0" placeholder="-" className={styles.qtyInput} style={{ borderColor: isOver ? '#d82c0d' : undefined, backgroundColor: isOver ? '#fff4f4' : undefined }} value={qty} onChange={(e) => { const val = e.target.value ? parseInt(e.target.value) : undefined; setQuantities(p => val ? ({ ...p, [vid]: val }) : (delete p[vid], { ...p })); }} />
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px', color: isOut || isOver ? '#d82c0d' : '#616161' }}><span>{isOut ? "Out" : `${stock}`}</span>{isOver && <AlertCircle size={10} />}</div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* FOOTER INPUTS SECTION */}
              <div style={{ padding: "20px", background: "#fcfcfc", borderTop: "1px solid #e1e3e5" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "30px", flexDirection: "column" }}>

                  {/* LEFT: PO & Notes */}
                  <div style={{ flex: 1, minWidth: "300px", display: "flex", gap: "20px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#303030" }}>PO Number</label>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <div style={{ position: "absolute", left: "10px", pointerEvents: "none", display: "flex", alignItems: "center" }}><FileText size={16} color="#5c5f62" /></div>
                        <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-5544" autoComplete="off" className={styles.inp} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "500", color: "#303030" }}>Order Note</label>
                      <input type="text" value={note} className={styles.inp} onChange={(e) => setNote(e.target.value)} placeholder="Notes..." autoComplete="off" />
                    </div>
                  </div>

                  {/* RIGHT: Discount */}
                  <div style={{ flex: 1, minWidth: "220px", gap: "8px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "600", color: "#303030" }}>Apply Discount</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <div style={{ flex: 1 }}>
                        <input type="number" className={styles.inp} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0.00" />
                      </div>
                      <div style={{ flex: 1, display: "flex", background: "#fff", border: "1px solid #898f94", borderRadius: "12px", overflow: "hidden" }}>
                        <button onClick={() => setDiscountType("FIXED_AMOUNT")} style={{ flex: 1, border: "none", cursor: "pointer", background: discountType === "FIXED_AMOUNT" ? "#e3f1df" : "white", color: discountType === "FIXED_AMOUNT" ? "#007a5c" : "#616161", fontWeight: "bold" }}>$</button>
                        <div style={{ width: "1px", background: "#ccc" }}></div>
                        <button onClick={() => setDiscountType("PERCENTAGE")} style={{ flex: 1, border: "none", cursor: "pointer", background: discountType === "PERCENTAGE" ? "#e3f1df" : "white", color: discountType === "PERCENTAGE" ? "#007a5c" : "#616161", fontWeight: "bold" }}>%</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div
                className={styles.actionFooter}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "24px",
                  padding: "20px 24px",
                  background: "#ffffff",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                {/* TOTAL */}
                <div
                  onClick={() => setIsBreakdownOpen(true)}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      color: "#6b7280",
                      textTransform: "uppercase",
                    }}
                  >
                    Total estimate
                  </span>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "10px",
                    }}
                  >
                    {parseFloat(orderSummary.discountAmount) > 0 && (
                      <span
                        style={{
                          fontSize: "14px",
                          color: "#9ca3af",
                          textDecoration: "line-through",
                        }}
                      >
                        ${orderSummary.subtotalPrice}
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: "22px",
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      ${orderSummary.finalTotalPrice}
                    </span>

                    <span
                      style={{
                        fontSize: "13px",
                        color: "#9ca3af",
                      }}
                    >
                      · {orderSummary.totalItems} items
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "#2563eb",
                    }}
                  >
                    View details →
                  </span>
                </div>

                {/* CTA */}
                <Button
                  variant="primary"
                  onClick={handleCreateOrder}
                  loading={isLoading}
                  disabled={totalQty === 0}
                  size="large"
                  style={{
                    borderRadius: "999px",
                    padding: "12px 22px",
                    fontWeight: 600,
                  }}
                >
                  {customer
                    ? `Create order for ${customer.displayName}`
                    : "Create draft order"}
                </Button>
              </div>

            </div>
            {actionData?.status === "success" && (<div className={styles.airSuccessWrapper}><div className={styles.airSuccessCard}><div className={styles.airSuccessIcon}>✓</div><div className={styles.airSuccessContent}><h4>Order created successfully</h4><p>Draft order <strong>{actionData?.order?.name}</strong> has been created.</p><Button url={actionData?.order?.invoiceUrl} target="_blank" className={styles.airSuccessBtn}>View invoice</Button></div></div></div>)}
          </Card>
        </Layout.Section>
      </Layout>
      <CustomerSearchModal open={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} onSelect={(c) => setCustomer(c)} />
      <BreakdownModal open={isBreakdownOpen} onClose={() => setIsBreakdownOpen(false)} summary={orderSummary} />
    </Page>
  );
}