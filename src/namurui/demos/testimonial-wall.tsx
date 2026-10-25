import { type CSSProperties } from "react";
import { TestimonialWall, type Testimonial } from "../testimonial-wall";

const items: Testimonial[] = [
  {
    quote: "We deleted four internal component folders in one sprint. Nobody has asked for them back.",
    name: "Lena Hartmann",
    role: "Design Lead",
    company: "Fieldnote",
    rating: 5,
    verified: true,
  },
  {
    quote: "The motion is the part nobody notices, which is exactly the point. It never fights the content.",
    name: "Jonas Weber",
    role: "Staff Engineer",
    company: "Ledgerline",
    verified: true,
  },
  {
    quote:
      "Our design review used to end with screenshots and arguments. Now we open the preview and settle it in a minute.",
    name: "Priya Raghavan",
    role: "Head of Product",
    company: "Northbeam",
    rating: 5,
  },
  {
    quote: "Accessibility stopped being a cleanup task. The defaults already handle focus, labels and reduced motion.",
    name: "Tomás Ferreira",
    role: "Frontend Architect",
    company: "Cadence",
    rating: 5,
    verified: true,
  },
  {
    quote: "Shipped a pricing page in two days, including the empty states. That never happens with our old kit.",
    name: "Aiko Tanaka",
    role: "Founding Designer",
    company: "Tandem",
  },
  {
    quote:
      "We run it in a dense internal tool at 320px and on a 4K dashboard. Same components, no special cases, no overflow bugs.",
    name: "Marcus Bell",
    role: "Engineering Manager",
    company: "Parcelworks",
    verified: true,
  },
  {
    quote: "Dark mode was one afternoon, not a quarter. It is tokens all the way down, so nothing drifted.",
    name: "Sofia Lindgren",
    role: "Design Systems",
    company: "Vellum",
    rating: 4,
  },
  {
    quote: "The motion timings are calm enough for a banking product. Legal signed off without a single change.",
    name: "Daniel Okafor",
    role: "Product Design",
    company: "Kestrel",
    rating: 5,
    verified: true,
  },
  {
    quote: "Copy-paste a file, own it, change it. No package upgrades breaking the checkout flow at 5pm on a Friday.",
    name: "Hannah Wirtz",
    role: "Principal Engineer",
    company: "Halcyon",
  },
  {
    quote: "Our new hires read the component source instead of a wiki. Everything they need is in the file.",
    name: "Ravi Menon",
    role: "Design Engineer",
    company: "Fieldnote",
    verified: true,
  },
  {
    quote: "Every interactive piece answers the keyboard properly. It cut our audit findings by two thirds.",
    name: "Clara Nyström",
    role: "Accessibility Lead",
    company: "Ledgerline",
    rating: 5,
  },
  {
    quote: "Two people, one product, no design system team. It is the reason we can keep that ratio.",
    name: "Owen Clarke",
    role: "Co-founder",
    company: "Northbeam",
    rating: 5,
    verified: true,
  },
];

export default function Demo() {
  return (
    <div style={{ display: "grid", gap: 12, width: "100%" }}>
      <div style={{ display: "grid", gap: 4, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-subtle, #8f8f8f)" }}>Testimonials</p>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text, #171717)" }}>
          Loved by product teams
        </h2>
      </div>

      <div style={{ "--ui-tw-height": "440px" } as CSSProperties}>
        <TestimonialWall
          items={items}
          speed={24}
          label="What product teams say"
        />
      </div>
    </div>
  );
}
