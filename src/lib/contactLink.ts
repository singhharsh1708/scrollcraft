import { isAllowedHref } from "@/lib/hrefRule";

export type ContactVia = "call" | "whatsapp";

type Phone = { digits: string; international: boolean };

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const PHONE = /^\+?[\d\s().-]+$/;
const BARE_DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[:/?#]\S*)?$/i;
// Numbers copied from a phone's contacts arrive wrapped in invisible direction marks.
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;

export function readPhone(raw: string): Phone | null {
  let value = raw.replace(INVISIBLE, "").replace(/[\u2010-\u2015\u2212]/g, "-").trim();
  value = value.replace(/^tel:/i, "").replace(/^\(\s*(\+|00)\s*(\d{1,4})\s*\)/, "$1$2 ");
  if (!PHONE.test(value)) return null;
  let international = value.startsWith("+") || value.startsWith("00");
  if (international) value = value.replace(/^(?:\+|00)/, "").replace(/\(0\)/g, "");
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (!international) international = digits.length >= 12 && !digits.startsWith("0");
  return international && digits.startsWith("0") ? null : { digits, international };
}

function phoneLink(phone: Phone, via: ContactVia): string | null {
  if (via === "call") return `tel:${phone.international ? "+" : ""}${phone.digits}`;
  return phone.international ? `https://wa.me/${phone.digits}` : null;
}

function webLink(value: string): string | null {
  const href = /^https?:\/\//i.test(value) ? value : BARE_DOMAIN.test(value) ? `https://${value}` : null;
  if (!href || /\s/.test(href)) return null;
  try {
    return new URL(href).hostname.includes(".") ? href : null;
  } catch {
    return null;
  }
}

export function contactLink(raw: string, via: ContactVia): string | null {
  const value = raw.replace(INVISIBLE, "").trim();
  const email = value.replace(/^mailto:/i, "");
  const phone = readPhone(value);
  const href = EMAIL.test(email) ? `mailto:${email}` : phone ? phoneLink(phone, via) : webLink(value);
  return href !== null && href.length <= 2000 && isAllowedHref(href) ? href : null;
}

// briefToSite points every button at #contact, an id no section carries.
export function withContactLink<T extends { ctaHref?: string }>(sections: T[], href: string | null): T[] {
  if (!href) return sections;
  return sections.map((section) => (section.ctaHref === "#contact" ? { ...section, ctaHref: href } : section));
}
