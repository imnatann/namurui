import { Button } from "../button";
import {
  StepperChoices,
  StepperField,
  StepperForm,
  StepperInput,
  StepperReview,
  StepperSuccess,
  StepperTags,
  type Step,
} from "../stepper-form";

type Values = { name: string; slug: string; invites: string[]; plan: string };

const plans = [
  { value: "starter", title: "Starter", aside: "$0", description: "3 members · 1,000 credits a month" },
  { value: "pro", title: "Pro", aside: "$19", description: "10 members · 20,000 credits", badge: "Popular" },
  { value: "studio", title: "Studio", aside: "$49", description: "Unlimited members · 100,000 credits" },
];

/** URLs already used by someone else – the slug step says so before it moves on. */
const TAKEN = ["admin", "billing", "namurui", "support"];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);

/** Stands in for the call that would create the workspace. */
async function createWorkspace(values: Values) {
  const { promise, resolve } = Promise.withResolvers<void>();
  window.setTimeout(resolve, 900);
  await promise;
  if (!values.name.trim()) throw new Error("Give the workspace a name first");
}

export default function Demo() {
  const steps: Step<Values>[] = [
    {
      id: "workspace",
      title: "Workspace",
      heading: "Name your workspace",
      description: "This is where your team's projects live.",
      render: ({ values, setValues }) => (
        <>
          <StepperField name="name" label="Workspace name">
            <StepperInput
              value={values.name}
              placeholder="Acme Inc."
              maxLength={48}
              onChange={(event) => setValues({ name: event.target.value, slug: slugify(event.target.value) })}
            />
          </StepperField>
          <StepperField name="slug" label="Workspace URL" hint="Lowercase letters, numbers and dashes">
            <StepperInput
              prefix="namurui.app/"
              value={values.slug}
              placeholder="acme"
              maxLength={32}
              onChange={(event) => setValues({ slug: slugify(event.target.value) })}
            />
          </StepperField>
        </>
      ),
      validate: (values) => {
        const problems: Record<string, string | undefined> = {};
        if (!values.name.trim()) problems.name = "Give your workspace a name";
        else if (values.name.trim().length < 3) problems.name = "Use at least three characters";
        if (!values.slug) problems.slug = "Pick a URL for the workspace";
        else if (TAKEN.includes(values.slug)) problems.slug = "That URL is taken – try another";
        return problems;
      },
    },
    {
      id: "team",
      title: "Team",
      heading: "Invite your team",
      description: "They get an email with a link – you can always add more later.",
      render: ({ values, setValues }) => (
        <StepperField name="invites" label="Email addresses" hint="Press Enter after each one, or paste a list" optional>
          <StepperTags value={values.invites} onChange={(invites) => setValues({ invites })} />
        </StepperField>
      ),
    },
    {
      id: "plan",
      title: "Plan",
      heading: "Pick a plan",
      description: "Change it any time – you only pay for the months you use.",
      render: ({ values, setValues }) => (
        <StepperChoices label="Plan" value={values.plan} options={plans} onChange={(plan) => setValues({ plan })} />
      ),
    },
    {
      id: "review",
      title: "Review",
      heading: "Check it over",
      description: "Nothing is created until you press the button.",
      render: ({ values, goTo }) => (
        <StepperReview
          onEdit={goTo}
          rows={[
            { label: "Workspace", value: values.name, step: "workspace" },
            { label: "Plan", value: plans.find((plan) => plan.value === values.plan)?.title ?? values.plan, step: "plan" },
            {
              label: "Team",
              value: values.invites.length
                ? `${values.invites.length} invite${values.invites.length === 1 ? "" : "s"}`
                : "Just you for now",
              step: "team",
            },
          ]}
        />
      ),
    },
  ];

  return (
    <StepperForm<Values>
      steps={steps}
      initialValues={{ name: "Northwind Studio", slug: "northwind-studio", invites: [], plan: "pro" }}
      submitLabel="Create workspace"
      submittingLabel="Creating…"
      onSubmit={createWorkspace}
      success={(values, reset) => (
        <StepperSuccess
          title={`${values.name.trim() || "Your workspace"} is ready`}
          description={
            values.invites.length
              ? `We sent ${values.invites.length} invite${values.invites.length === 1 ? "" : "s"} and started you on ${plans.find((plan) => plan.value === values.plan)?.title ?? values.plan}. Everything else lives in Settings.`
              : `You're on ${plans.find((plan) => plan.value === values.plan)?.title ?? values.plan} with the whole workspace to yourself. Invite the team whenever you like.`
          }
        >
          <Button variant="secondary" size="sm" onClick={reset}>
            Set up another
          </Button>
        </StepperSuccess>
      )}
    />
  );
}
