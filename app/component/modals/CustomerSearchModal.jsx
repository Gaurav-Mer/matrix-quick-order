import {
    Text,
    Modal, Combobox, Listbox, Icon,
} from "@shopify/polaris";
import { useFetcher } from "@remix-run/react";
import { useState, useCallback } from "react";
import { SearchIcon } from "@shopify/polaris-icons";


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

export default CustomerSearchModal;