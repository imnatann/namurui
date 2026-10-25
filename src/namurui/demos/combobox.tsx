import { useState } from "react";
import { Combobox, type ComboboxGroup } from "../combobox";

const reviewers: ComboboxGroup[] = [
  {
    label: "Design",
    options: [
      { value: "maya", label: "Maya Chen", hint: "Product Designer", avatar: true },
      { value: "jonas", label: "Jonas Weber", hint: "Design Lead", avatar: true },
      { value: "priya", label: "Priya Raman", hint: "Brand Designer", avatar: true },
    ],
  },
  {
    label: "Engineering",
    options: [
      { value: "sara", label: "Sara Okafor", hint: "Staff Engineer", avatar: true },
      { value: "leo", label: "Leo Martins", hint: "Frontend", avatar: true },
      { value: "nina", label: "Nina Petrova", hint: "Backend", avatar: true },
      { value: "tom", label: "Tom Becker", hint: "iOS", avatar: true },
    ],
  },
  {
    label: "Product",
    options: [
      { value: "elif", label: "Elif Yilmaz", hint: "Head of Product", avatar: true },
      { value: "daniel", label: "Daniel Kim", hint: "Product Manager", avatar: true },
      { value: "lucas", label: "Lucas Moreau", hint: "Product Analyst", avatar: true },
    ],
  },
];

export default function Demo() {
  const [picked, setPicked] = useState<string[]>([]);

  return (
    <div style={{ width: "100%", maxWidth: 420 }}>
      <Combobox
        multiple
        defaultOpen
        label="Reviewers"
        placeholder="Add reviewers…"
        options={reviewers}
        value={picked}
        onChange={setPicked}
        creatable
        createLabel={(text) => `Add “${text}”`}
        onCreate={(text) => ({ value: text.toLowerCase(), label: text, hint: "Invited by email", avatar: true })}
        emptyText="Nobody matches that name yet"
      />
    </div>
  );
}
