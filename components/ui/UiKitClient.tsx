"use client";

import React, { useState } from "react";
import { Footprints, Plus, Settings, Trash2, Utensils } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Surface } from "@/components/ui/Surface";
import { List, ListRow } from "@/components/ui/List";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Tick } from "@/components/ui/Tick";
import { ProgressTrack } from "@/components/ui/ProgressTrack";
import { Stat } from "@/components/ui/Stat";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { NumberField } from "@/components/ui/NumberField";
import { Checkbox } from "@/components/ui/Checkbox";
import { Sheet } from "@/components/ui/Sheet";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SuggestedCard } from "@/components/ui/SuggestedCard";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { useTheme } from "@/hooks/useTheme";
import { THEME_OPTIONS, type ThemePreference } from "@/lib/ui/theme";

const SAMPLE_COLOURS = ["var(--accent)", "var(--ok)", "var(--warn)"];

interface SampleItem {
  id: string;
  title: string;
}

/** Development-only gallery of the primitives (see app/(app)/ui-kit/page.tsx). */
export function UiKitClient() {
  const { toast } = useToast();
  const { preference, setPreference } = useTheme();
  const [range, setRange] = useState<"30d" | "90d">("30d");
  const [ticks, setTicks] = useState([true, false]);
  const [weight, setWeight] = useState<number | null>(80);
  const [mealType, setMealType] = useState<string | null>("lunch");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const [items, setItems] = useState<SampleItem[]>([
    { id: "a", title: "Chicken rice bowl" },
    { id: "b", title: "Greek yogurt and oats" },
    { id: "c", title: "Whey shake and banana" },
  ]);

  const undoable = useUndoableDelete<SampleItem>({
    getId: (item) => item.id,
    message: (item) => `${item.title} deleted`,
    // A real screen calls its API here; the sample only drops the item.
    commit: async (item) => setItems((current) => current.filter((entry) => entry.id !== item.id)),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-8">
      <p className="text-sm text-ink-2">
        Development-only gallery of the design-system primitives. Not shown in production.
      </p>

      <section className="space-y-3">
        <SectionHeader title="Appearance" />
        <SegmentedControl<ThemePreference>
          label="Appearance"
          value={preference}
          options={THEME_OPTIONS}
          onChange={setPreference}
          className="w-full"
        />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Buttons" />
        <Surface className="space-y-3">
          <Button size="lg" fullWidth startContent={<Plus className="h-4 w-4" />}>
            Log meal
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" startContent={<Trash2 className="h-4 w-4" />}>
              Delete
            </Button>
            <Button size="sm">Resume</Button>
            <Button size="sm" variant="secondary">
              Start
            </Button>
            <Button isLoading>Saving</Button>
          </div>
          <div className="flex gap-1">
            <IconButton label="Settings" icon={<Settings className="h-5 w-5" />} />
            <IconButton label="Add" variant="secondary" icon={<Plus className="h-5 w-5" />} />
          </div>
        </Surface>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Ledger" meta="Stat · ProgressTrack · Chip" />
        <Surface padded={false} className="overflow-hidden">
          <div className="p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <Stat label="Calories" value="750" unit="kcal left" size="display" className="gap-0" />
              <span className="font-mono text-xs text-ink-3">1,650 of 2,400</span>
            </div>
            <ProgressTrack value={1650} max={2400} label="Calories eaten" />
          </div>
          <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
            <Stat label="Protein" value="142" unit="/ 180 g" className="px-3 py-2.5">
              <ProgressTrack value={142} max={180} size="sm" />
            </Stat>
            <Stat label="Carbs" value="158" unit="g" className="px-3 py-2.5" />
            <Stat label="Over" value="120" unit="kcal" tone="warn" className="px-3 py-2.5" />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line p-4">
            <Chip>Lunch</Chip>
            <Chip tone="accent">Today</Chip>
            <Chip tone="ok">Saved</Chip>
            <Chip tone="warn">New PR</Chip>
            <Chip tone="danger">Not saved</Chip>
          </div>
          <div className="border-t border-line p-4">
            <span className="mb-1.5 block text-xs text-ink-3">Rest (live)</span>
            <ProgressTrack value={65} max={100} size="sm" tone="accent" />
          </div>
        </Surface>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Rows and ticks" meta={`${ticks.filter(Boolean).length} of 2 done`} />
        <List>
          <ListRow
            title="Creatine 5 g"
            muted={ticks[0]}
            barColor={SAMPLE_COLOURS[1]}
            trailing={
              <Tick checked={ticks[0]} onChange={(next) => setTicks([next, ticks[1]])} label="Creatine 5 g done" />
            }
          />
          <ListRow
            title="Evening walk · 20 min"
            muted={ticks[1]}
            barColor={SAMPLE_COLOURS[0]}
            trailing={
              <Tick checked={ticks[1]} onChange={(next) => setTicks([ticks[0], next])} label="Evening walk done" />
            }
          />
          <ListRow title="Steps" subtitle="6,420 of 10,000" leading={<Footprints className="h-4 w-4 text-ink-3" />} href="/body-comp" />
        </List>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Fields" />
        <Surface className="space-y-4">
          <SegmentedControl
            label="Range"
            value={range}
            options={[
              { value: "30d", label: "30d" },
              { value: "90d", label: "90d" },
            ]}
            onChange={setRange}
          />
          <Input label="Meal name" placeholder="e.g. Chicken rice bowl" />
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Weight (steppers ±2.5)</span>
            <NumberField label="Weight" value={weight} onChange={setWeight} decimals={1} step={2.5} suffix="kg" max={500} />
          </div>
          <Select
            label="Meal type"
            value={mealType}
            onChange={setMealType}
            options={[
              { value: "breakfast", label: "Breakfast" },
              { value: "lunch", label: "Lunch" },
              { value: "dinner", label: "Dinner" },
              { value: "snack", label: "Snack" },
            ]}
          />
          <Textarea label="Notes" placeholder="Optional" rows={2} />
          <Checkbox label="Remind me" description="A reminder before the event starts." />
          <Input label="With an error" isInvalid errorMessage="Enter a number between 1 and 500." defaultValue="0" />
        </Surface>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Overlays and toasts" />
        <Surface className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Open sheet
          </Button>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Confirm (irreversible)
          </Button>
          <Popover
            role="menu"
            label="Meal options"
            align="start"
            trigger="Menu popover"
            triggerClassName="inline-flex min-h-11 items-center rounded-control border border-line bg-elevated px-4 text-sm font-medium text-ink"
            className="w-56"
          >
            {({ close }) => (
              <>
                <MenuItem icon={<Utensils className="h-[18px] w-[18px]" />} onSelect={close}>
                  Log again
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 className="h-[18px] w-[18px]" />} tone="danger" onSelect={close}>
                  Delete
                </MenuItem>
              </>
            )}
          </Popover>
          <Button variant="secondary" onClick={() => toast("Meal added", "success")}>
            Success toast
          </Button>
          <Button variant="secondary" onClick={() => toast("Could not save. Check your connection.", "error")}>
            Error toast
          </Button>
        </Surface>

        <SectionHeader title="Reversible delete (7 s Undo)" meta={`${items.length - undoable.hiddenIds.size} shown`} />
        <List>
          {items
            .filter((item) => !undoable.isHidden(item.id))
            .map((item) => (
              <ListRow
                key={item.id}
                title={item.title}
                trailing={
                  <IconButton
                    label={`Delete ${item.title}`}
                    icon={<Trash2 className="h-4 w-4" />}
                    size="sm"
                    onClick={() => undoable.remove(item)}
                  />
                }
              />
            ))}
        </List>
      </section>

      <section className="space-y-3">
        <SectionHeader title="AI output" />
        <SuggestedCard
          meta="Photo scan · Tap to edit"
          state={applied ? "applied" : "suggested"}
          onAccept={() => setApplied(true)}
          onDismiss={() => toast("Suggestion dismissed")}
        >
          <p className="text-section font-semibold text-ink">Grilled salmon and quinoa</p>
          <p className="mt-0.5 font-mono text-xs text-ink-2">540 kcal · 44 g P · 38 g C · 22 g F</p>
        </SuggestedCard>
        <SuggestedCard meta="Scanning photo" isLoading>
          {null}
        </SuggestedCard>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Empty and loading" />
        <EmptyState
          icon={<Utensils className="h-5 w-5" />}
          title="No meals yet"
          description="Log what you eat to see calories left for the day."
          actions={<Button size="md">Log meal</Button>}
        />
        <Surface className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton lines={3} />
        </Surface>
      </section>

      <Sheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Log weight"
        description="Saved to today."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSheetOpen(false);
                toast("Weight logged", "success");
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <NumberField label="Weight" value={weight} onChange={setWeight} decimals={1} step={0.1} suffix="kg" max={500} />
      </Sheet>

      <ConfirmDialog
        isOpen={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          toast("Check-in deleted", "info");
        }}
        title="Delete this check-in?"
        message="Its two progress photos are deleted too. This cannot be undone."
        confirmLabel="Delete check-in"
        destructive
      />
    </div>
  );
}

export default UiKitClient;
