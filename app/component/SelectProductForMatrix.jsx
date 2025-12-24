import { Page, Layout, Card, BlockStack, Text, Banner, Button, Spinner } from "@shopify/polaris";

const SelectProductForMatrix = ({ selectProduct }) => {
    return (
        <Page title="Matrix Quick Order">
            <Layout>
                <Layout.Section>
                    <Card>
                        <div style={{
                            textAlign: "center",
                            padding: "80px 40px",
                            position: "relative"
                        }}>
                            {/* Decorative background elements */}
                            <div style={{
                                position: "absolute",
                                top: "20px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                width: "300px",
                                height: "300px",
                                background: "radial-gradient(circle, rgba(0,0,0,0.015) 0%, transparent 70%)",
                                pointerEvents: "none"
                            }}></div>

                            {/* Illustration/Icon */}
                            <SvgImg />

                            {/* Content */}
                            <div style={{ maxWidth: "480px", margin: "10px auto" }}>
                                <Text variant="headingLg" as="h2" style={{
                                    fontSize: "24px",
                                    fontWeight: "600",
                                    color: "#0a0a0a",
                                    marginBottom: "12px",
                                    letterSpacing: "-0.02em"
                                }}>
                                    Select a Product
                                </Text>

                                <p style={{
                                    margin: "0 0 32px",
                                    color: "#737373",
                                    fontSize: "15px",
                                    lineHeight: "1.6",
                                    letterSpacing: "-0.01em"
                                }}>
                                    Choose a product with Size & Color options to generate the matrix grid and start processing orders faster.
                                </p>

                                {/* Feature hints */}
                                <div style={{
                                    display: "flex",
                                    gap: "24px",
                                    justifyContent: "center",
                                    marginBottom: "32px",
                                    flexWrap: "wrap"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <div style={{
                                            width: "20px",
                                            height: "20px",
                                            borderRadius: "50%",
                                            background: "#f5f5f5",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center"
                                        }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                        <span style={{ fontSize: "13px", color: "#525252" }}>Size variants</span>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <div style={{
                                            width: "20px",
                                            height: "20px",
                                            borderRadius: "50%",
                                            background: "#f5f5f5",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center"
                                        }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                        <span style={{ fontSize: "13px", color: "#525252" }}>Color options</span>
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <div style={{
                                            width: "20px",
                                            height: "20px",
                                            borderRadius: "50%",
                                            background: "#f5f5f5",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center"
                                        }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                        <span style={{ fontSize: "13px", color: "#525252" }}>Quick ordering</span>
                                    </div>
                                </div>

                                <Button
                                    variant="primary"
                                    onClick={selectProduct}
                                    size="large"
                                >
                                    Browse Products
                                </Button>
                            </div>
                        </div>

                        <style dangerouslySetInnerHTML={{
                            __html: `
              @keyframes pulse {
                0%, 100% { 
                  opacity: 0.3;
                  transform: scale(1);
                }
                50% { 
                  opacity: 0.8;
                  transform: scale(1.2);
                }
              }
            `}} />
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    )
}

export default SelectProductForMatrix



const SvgImg = () => {
    return (
        <svg fill="#000000" width="80px" height="80px" viewBox="0 0 60 60" id="Capa_1" version="1.1" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
            <g>
                <path d="M24,22c0,0.553,0.448,1,1,1s1-0.447,1-1c0-2.206-1.794-4-4-4s-4,1.794-4,4c0,0.553,0.448,1,1,1s1-0.447,1-1   c0-1.103,0.897-2,2-2S24,20.897,24,22z" />

                <path d="M38,18c-2.206,0-4,1.794-4,4c0,0.553,0.448,1,1,1s1-0.447,1-1c0-1.103,0.897-2,2-2s2,0.897,2,2c0,0.553,0.448,1,1,1   s1-0.447,1-1C42,19.794,40.206,18,38,18z" />

                <path d="M53,14V0H7v14H6v46h48V14H53z M50.5,14l-5.18-6.906L50.414,2H51v12H50.5z M17,14V7c0-0.024-0.012-0.046-0.014-0.07   c-0.005-0.064-0.02-0.124-0.036-0.187c-0.011-0.042-0.01-0.085-0.027-0.125c-0.009-0.022-0.027-0.039-0.037-0.061   c-0.027-0.055-0.065-0.102-0.103-0.152c-0.028-0.036-0.044-0.081-0.077-0.113L12.414,2h35.172l-4.292,4.292   c-0.032,0.032-0.049,0.077-0.077,0.113c-0.038,0.05-0.075,0.097-0.102,0.152c-0.011,0.022-0.028,0.038-0.038,0.061   c-0.017,0.04-0.016,0.084-0.027,0.125c-0.017,0.063-0.032,0.122-0.036,0.187C43.012,6.954,43,6.976,43,7v7H17z M12,14l3-4.001V14   H12z M45,9.999L48,14h-3V9.999z M9,2h0.586l5.094,5.094L9.5,14H9V2z M52,58H8V16h44V58z" />

                <path d="M38,21c-0.552,0-1,0.447-1,1v6c0,3.859-3.14,7-7,7s-7-3.141-7-7v-6c0-0.553-0.448-1-1-1s-1,0.447-1,1v6   c0,4.963,4.038,9,9,9s9-4.037,9-9v-6C39,21.447,38.552,21,38,21z" />

            </g>

            <g />

            <g />

            <g />

            <g />

            <g />

            <g />

            <g />

            <g />

            <g />

            <g />

            <g />

            <g />

            <g />

            <g />

            <g />

        </svg>
    )
}