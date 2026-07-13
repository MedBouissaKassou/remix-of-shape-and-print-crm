import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export type ClientType = Database["public"]["Enums"]["client_type"];
export type ContactOrigin = "facebook" | "instagram" | "whatsapp" | "site_web" | "telephone" | "sur_lieu" | "autre";

const ORIGIN_OPTIONS: { value: ContactOrigin; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "Whatsapp" },
  { value: "site_web", label: "Site Web" },
  { value: "telephone", label: "Téléphone" },
  { value: "sur_lieu", label: "Sur lieu" },
  { value: "autre", label: "Autre" },
];

export type ClientFormValues = {
  full_name: string;
  phone: string;
  phone2: string;
  email: string;
  address: string;
  governorate: string;
  city: string;
  postal_code: string;
  client_type: ClientType;
  company_name: string;
  notes: string;
  brand_name: string;
  tax_id: string;
  contact_origin: ContactOrigin | "";
  contact_origin_other: string;
};

export const emptyClient: ClientFormValues = {
  full_name: "",
  phone: "",
  phone2: "",
  email: "",
  address: "",
  governorate: "",
  city: "",
  postal_code: "",
  client_type: "particulier",
  company_name: "",
  notes: "",
  brand_name: "",
  tax_id: "",
  contact_origin: "",
  contact_origin_other: "",
};

export function ClientForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Enregistrer",
}: {
  initial?: Partial<ClientFormValues>;
  onSubmit: (values: ClientFormValues) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<ClientFormValues>({ ...emptyClient, ...initial });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ClientFormValues>(k: K, v: ClientFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.full_name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="full_name">Nom complet *</Label>
          <Input id="full_name" value={values.full_name} onChange={(e) => set("full_name", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={values.client_type} onValueChange={(v) => set("client_type", v as ClientType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="particulier">Particulier</SelectItem>
              <SelectItem value="entreprise">Entreprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {values.client_type === "entreprise" && (
          <div className="space-y-1.5">
            <Label htmlFor="company_name">Société</Label>
            <Input id="company_name" value={values.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </div>
        )}
        {values.client_type === "entreprise" && (
          <div className="space-y-1.5">
            <Label htmlFor="tax_id">Matricule Fiscale</Label>
            <Input id="tax_id" value={values.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
          </div>
        )}
        {values.client_type === "particulier" && (
          <div className="space-y-1.5">
            <Label htmlFor="brand_name">Nom de Brand</Label>
            <Input id="brand_name" value={values.brand_name} onChange={(e) => set("brand_name", e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone2">Téléphone 2</Label>
          <Input id="phone2" value={values.phone2} onChange={(e) => set("phone2", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="address">Adresse</Label>
          <Input id="address" value={values.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="governorate">Gouvernorat</Label>
          <Input id="governorate" value={values.governorate} onChange={(e) => set("governorate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Ville</Label>
          <Input id="city" value={values.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="postal_code">Code postal</Label>
          <Input id="postal_code" value={values.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Origine de contact</Label>
          <Select value={values.contact_origin || undefined} onValueChange={(v) => set("contact_origin", v as ContactOrigin)}>
            <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
            <SelectContent>
              {ORIGIN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {values.contact_origin === "autre" && (
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="contact_origin_other">Préciser</Label>
            <Input id="contact_origin_other" value={values.contact_origin_other} onChange={(e) => set("contact_origin_other", e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={3} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Annuler</Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}