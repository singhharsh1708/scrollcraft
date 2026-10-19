import { siteUrl } from "@/lib/env";
import { BACKGROUND_LABELS } from "@/lib/templateFilters";
import { TEMPLATES, templateSectionCount, type Template } from "@/lib/templates";

export interface CategoryInfo {
  slug: string;
  /** How people search for it, e.g. "restaurant and cafe". */
  noun: string;
  description: string;
  guidance: string[];
}

export const CATEGORY_INFO: Record<string, CategoryInfo> = {
  SaaS: {
    slug: "saas",
    noun: "SaaS",
    description: "Free SaaS website templates for software products: problem, features, proof and a trial button, with scroll animation. Edit in the browser, export HTML.",
    guidance: [
      "A SaaS home page has one job: get the right visitor to start a trial or book a demo. Open with what the product does in one sentence, then name the problem in the words your buyers use. A short section on how things go wrong today does more than a list of features.",
      "Give each feature its own section and tie it to an outcome: fewer hours, a number someone can defend, a review that passes. Then answer the questions that stall a purchase: security and access, how data gets in, what happens if you leave.",
      "End with one call to action and say what happens after the click, for example a free trial with no card, or a 30 minute walkthrough on your own data.",
    ],
  },
  Portfolio: {
    slug: "portfolio",
    noun: "portfolio",
    description: "Free portfolio website templates for photographers, designers and studios, with scroll animation. Edit the words in your browser and export plain HTML.",
    guidance: [
      "A portfolio is judged in the first screen, so lead with the work or one sentence about it, not a biography. Group the work into a few series or projects and give each one a line of context: where, when, for whom.",
      "After the work, say how you work and what you take on, including what you turn down. Clients read that to decide whether to write. If you sell prints or license images, give the edition size or terms plainly.",
      "Finish with one way to get in touch and a hint of availability, such as commissions open for spring.",
    ],
  },
  Product: {
    slug: "product",
    noun: "product and app",
    description: "Free product and app website templates that give each feature a full screen, with scroll animation. Edit in your browser, export plain HTML.",
    guidance: [
      "A product page works when it shows one thing at a time. Open with the product and a short claim, then give each feature or part its own screen: what it is, and why it matters to the person holding it.",
      "For a physical product, cover materials, how it is made, and what owning it is like. For an app, cover the daily use, offline behaviour, and what happens to the user's data.",
      "Close with the single action you want, such as reserve, buy or download, and any honest limit like a small batch or a beta.",
    ],
  },
  "Food & Drink": {
    slug: "food-and-drink",
    noun: "restaurant and cafe",
    description: "Free restaurant, cafe and coffee shop website templates with scroll animation. Kitchen, room, menu notes and bookings. Edit in the browser, export HTML.",
    guidance: [
      "People open a restaurant or cafe site to answer a few questions fast: what kind of food, what the room is like, when you are open, and how to book. Put the booking or order button where it cannot be missed, at the start and at the end.",
      "In between, describe the kitchen and where the food comes from in specific terms, such as a wood hearth, two named farms, or beans roasted that morning. A section on the room (how many seats, how loud) helps people choose you for the right occasion.",
      "Add a short section on what you can and cannot do, like dietary needs, group sizes and opening days. It saves you phone calls and stops bad reviews.",
    ],
  },
  Event: {
    slug: "event",
    noun: "event and conference",
    description: "Free event and conference website templates: date, venue, programme, speakers and tickets, with scroll animation. Edit in your browser, export plain HTML.",
    guidance: [
      "An event page answers three questions before anything else: when, where, and how to get a ticket. Put the date and city in the first screen and repeat the ticket button at the end.",
      "Then explain the programme format, who is speaking, and who usually attends, because people buy tickets to meet the room as much as to hear the talks. A section on getting there (venue, transport, nearby hotels) removes a common reason to hesitate.",
      "If seats are limited, say how many. It is useful information, not just pressure.",
    ],
  },
  Fitness: {
    slug: "fitness",
    noun: "gym and fitness",
    description: "Free gym and fitness website templates with scroll animation: coaching, sessions, membership and a free first visit. Edit in the browser, export HTML.",
    guidance: [
      "A gym site has to make a nervous beginner feel welcome and an experienced lifter feel taken seriously. Say who coaches, how big the groups are, and what a session looks like, in plain numbers.",
      "Show the room and the equipment, and give a section to starting out: what happens on day one and what to bring. Membership terms belong on the page too, especially if there is no contract.",
      "End with a low-risk first step, such as a free first session or a trial week, and one button to book it.",
    ],
  },
  "Real Estate": {
    slug: "real-estate",
    noun: "real estate",
    description: "Free real estate website templates for a single property listing, with scroll animation: view, rooms, garden and area. Edit in the browser, export HTML.",
    guidance: [
      "A single-property site should sell the feeling of living there before the floor plan. Open with the best fact about the place, such as the view or the light, then walk through the house, the rooms, the outside space and the neighbourhood.",
      "Give real numbers: floor area, age of the building, recent work done, distance to transport. A short section on things a buyer should know builds trust and filters out viewings that would go nowhere.",
      "Finish with how to arrange a viewing and when viewings start.",
    ],
  },
  Editorial: {
    slug: "editorial",
    noun: "blog and author",
    description: "Free blog and author website templates for a long essay or a book launch, with scroll animation. Edit the words in your browser and export plain HTML.",
    guidance: [
      "A writing site should get out of the way of the words. For one long essay, break it into parts with clear headings so a reader can see the shape of the argument and come back to it later.",
      "For a book launch, cover what the book is about, the research behind it, why it matters now, and the physical object if it is special. Readers like to know how long it took and what it is made of.",
      "End with one next step: subscribe for the next essay, or pre-order the book.",
    ],
  },
  Nonprofit: {
    slug: "nonprofit",
    noun: "nonprofit and NGO",
    description: "Free nonprofit, NGO and charity website templates with scroll animation: the problem, the work, where the money goes. Edit in the browser, export HTML.",
    guidance: [
      "A charity or NGO site should ask once, clearly, after it has explained the problem. Lead with one concrete number about the people or places you serve, then say why it matters and what you actually do.",
      "Donors want to know how the work is done and where the money goes, so give the share that reaches the work and say who does it. A short section on what you will not do, such as using photos of beneficiaries without consent, builds trust.",
      "Finish with one donate button and a sense of what a gift pays for.",
    ],
  },
  Travel: {
    slug: "travel",
    noun: "travel",
    description: "Free travel website templates for tours and travel apps, with scroll animation: route, nights, guides and group size. Edit in your browser, export HTML.",
    guidance: [
      "A travel page sells a specific trip, not travel in general. Open with the place and the length of the trip, then describe the route, where people sleep, and who guides them.",
      "Be honest about difficulty, altitude and fitness, and say how big the group is. Those are the questions that decide whether someone books or writes to ask. For a travel app, show the trip from planning to the shared bill.",
      "End with dates or a download button, and keep it to one.",
    ],
  },
  "E-commerce": {
    slug: "e-commerce",
    noun: "ecommerce",
    description: "Free ecommerce website templates for a skincare or beauty shop, with scroll animation: formula, sourcing and routine. Edit in the browser, export HTML.",
    guidance: [
      "A small shop page does best when it keeps one product or collection on screen at a time. Open with the collection and a shop button, then explain what is in the product and why each part is there.",
      "Cover sourcing, testing and how to use it, in a few short steps. If the packaging is refillable or the ingredients are named on the label, say so.",
      "The page links out to your checkout, so finish with one clear button to the shop.",
    ],
  },
  Gaming: {
    slug: "gaming",
    noun: "gaming",
    description: "Free gaming website templates for a game launch or new season, with scroll animation: world, classes, co-op, pricing. Edit in the browser, export HTML.",
    guidance: [
      "A game page should open on atmosphere, then answer what players actually ask: what kind of game it is, who you play with, and what costs money.",
      "Give a section to the world and one to characters or classes. If there are seasons, say what changes. Be plain about pricing, especially for a free-to-play game.",
      "End with the platform and one play or download button.",
    ],
  },
  Launch: {
    slug: "launch",
    noun: "coming soon and startup",
    description: "Free coming soon and startup website templates with scroll animation, including a waitlist page that collects emails. Edit in the browser, export HTML.",
    guidance: [
      "A pre-launch page has one goal: collect the email addresses of people who want the thing. Say what it is and when it opens in the first screen, and put the signup form there and again at the end.",
      "Between the two, describe the problem, how the product solves it, and one or two details that make it different. A startup page can also say what the product is not, which reads as confidence.",
      "Keep it short. Four or five sections are enough before asking for the email.",
    ],
  },
};

interface TemplateUse {
  /** Leads the title: "{useCase} website template". */
  useCase: string;
  /** Finishes "Free ... website template". */
  phrase: string;
  forWhom: string;
}

export const TEMPLATE_USE: Record<string, TemplateUse> = {
  orbitcrm: { useCase: "SaaS", phrase: "SaaS and B2B software product", forWhom: "A B2B software company selling to sales or revenue teams, where the page needs to explain a problem before it lists features." },
  "atlas-studio": { useCase: "Design agency", phrase: "design agency and studio", forWhom: "A small design or development studio that wants to explain how it works and who it takes on, rather than show a logo wall." },
  "meridian-watch": { useCase: "Single product", phrase: "single product and maker", forWhom: "A maker selling one physical object, such as a watch, a bag or a tool, in a small batch, where every part of it is worth a screen." },
  "kiln-coffee": { useCase: "Coffee shop", phrase: "coffee shop and roastery", forWhom: "A cafe or small coffee roaster that sells bags online and runs a shop, and wants to talk about sourcing, freshness and opening hours." },
  northlight: { useCase: "Photography portfolio", phrase: "photography portfolio", forWhom: "A landscape or fine-art photographer who shows work as series and sells editioned prints or takes commissions." },
  "signal-conf": { useCase: "Conference", phrase: "conference and event", forWhom: "Organisers of a conference, meetup or festival who need date, venue, programme, speakers and tickets on one page." },
  "quarry-fitness": { useCase: "Gym", phrase: "gym and fitness studio", forWhom: "A small gym, CrossFit box or coaching studio that runs group sessions and wants beginners to book a first visit." },
  "ledger-fintech": { useCase: "Fintech", phrase: "fintech and finance software", forWhom: "A finance or accounting software company selling to finance teams, where the headline is a number the product changes." },
  "harbour-estate": { useCase: "Real estate listing", phrase: "real estate and property listing", forWhom: "An agent or owner selling or letting one property, such as a house, a holiday let or a flat, who wants it to have its own page." },
  "field-notes": { useCase: "Blog", phrase: "blog and long-form essay", forWhom: "A writer, newsletter author or magazine publishing one long piece that deserves its own page, with a subscribe button at the end." },
  "pulse-app": { useCase: "Mobile app", phrase: "mobile app launch and beta", forWhom: "A small team launching a phone app, one feature per screen, with a download button and a note on how user data is handled." },
  "cinder-restaurant": { useCase: "Restaurant", phrase: "restaurant and bistro", forWhom: "A small restaurant with a clear idea, a short menu and limited seats, that takes bookings and wants to set expectations before people arrive." },
  "beacon-nonprofit": { useCase: "Nonprofit", phrase: "nonprofit, NGO and charity", forWhom: "A charity, NGO or community project that does one kind of work and asks for donations once, after explaining it." },
  "vellum-books": { useCase: "Book launch", phrase: "book launch and author", forWhom: "An author or small publisher launching one book and taking pre-orders, with room for the research and the making of it." },
  "forge-devtool": { useCase: "Developer tool", phrase: "developer tool and dev SaaS", forWhom: "A developer tool, CLI or open-source project with a paid tier, written for people who read the docs before they install anything." },
  "solstice-travel": { useCase: "Tour", phrase: "tour operator and travel", forWhom: "A tour operator or travel agency selling a specific small-group trip, with the route, nights, guides and fitness level spelled out." },
  aurabeauty: { useCase: "Skincare shop", phrase: "skincare and beauty shop", forWhom: "A skincare, cosmetics or beauty brand with a small range that links to its own checkout, such as a Shopify store or a payment link." },
  nightrealm: { useCase: "Video game", phrase: "video game and gaming", forWhom: "An indie studio or game team announcing a game or a new season, that wants atmosphere first and plain answers on pricing." },
  tripvault: { useCase: "Travel app", phrase: "travel and trip planner app", forWhom: "A team launching a trip planning or travel companion app on iOS and Android, from planning to splitting costs." },
  greenshift: { useCase: "Climate startup", phrase: "climate and B2B startup", forWhom: "A climate or sustainability startup selling to companies, where the page has to be specific about what it does and what it is not." },
  ember: { useCase: "Steakhouse", phrase: "steakhouse and grill restaurant", forWhom: "A steakhouse, barbecue or grill restaurant that takes reservations and wants the fire, the meat and the wine list up front." },
  kept: { useCase: "Coming soon", phrase: "coming soon and waitlist", forWhom: "A founder collecting emails before launch. Paste a Mailchimp, Kit, Buttondown or Formspree link and the form sends signups there." },
  weft: { useCase: "Documentary photographer", phrase: "documentary photography portfolio", forWhom: "A documentary or editorial photographer who shows one long project, sells signed prints and licenses images for editorial use." },
};

export function categoryInfo(category: string): CategoryInfo {
  return CATEGORY_INFO[category];
}

export function categoryBySlug(slug: string): string | undefined {
  return Object.keys(CATEGORY_INFO).find((c) => CATEGORY_INFO[c].slug === slug);
}

export function categoryPath(category: string): string {
  return `/templates/category/${CATEGORY_INFO[category].slug}`;
}

export function categoryLabel(category: string): string {
  const noun = CATEGORY_INFO[category].noun;
  return noun[0].toUpperCase() + noun.slice(1);
}

export function categoryTitle(category: string): string {
  return `Free ${CATEGORY_INFO[category].noun} website templates`;
}

/** Without the " | ScrollCraft" the root layout appends. */
export function categoryMetaTitle(category: string): string {
  const base = categoryTitle(category);
  const long = `${base} (scroll animation)`;
  return long.length <= 60 ? long : base;
}

export function templateUse(t: Template): TemplateUse {
  return TEMPLATE_USE[t.slug];
}

/** Without the " | ScrollCraft" the root layout appends. */
export function templateMetaTitle(t: Template): string {
  const u = templateUse(t).useCase;
  const candidates = [
    `${u} website template with scroll animation: ${t.name}`,
    `${u} website template, scroll animated: ${t.name}`,
    `${u} website template: ${t.name}`,
  ];
  return candidates.find((c) => c.length <= 60) ?? candidates[candidates.length - 1];
}

export function templateDescription(t: Template): string {
  return `Free ${templateUse(t).phrase} website template with ${templateSectionCount(t)} scroll-animated sections. Edit it in your browser, export plain HTML and host it anywhere.`;
}

function withArticle(phrase: string): string {
  return /^[aeiou]/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
}

export function templateHeading(t: Template): string {
  const u = templateUse(t).useCase;
  const lower = u === "SaaS" ? u : u[0].toLowerCase() + u.slice(1);
  return `${t.name}: ${withArticle(lower)} website template`;
}

export function templateOutline(t: Template): string[] {
  return t.sections
    .filter((s) => s.kind !== "spacer" && s.heading)
    .map((s) => (s.eyebrow ? `${s.eyebrow}: ${s.heading}` : String(s.heading)));
}

export function backgroundLabel(t: Template): string {
  return BACKGROUND_LABELS[t.style] ?? t.style;
}

/** Same category first, then the catalogue after it, so a one-template category still links on. */
export function relatedTemplates(t: Template, n = 3): Template[] {
  const same = TEMPLATES.filter((o) => o.category === t.category && o.slug !== t.slug);
  const at = TEMPLATES.indexOf(t);
  const rest = [...TEMPLATES.slice(at + 1), ...TEMPLATES.slice(0, at)].filter((o) => o.category !== t.category);
  return [...same, ...rest].slice(0, n);
}

export function templatesIn(category: string): Template[] {
  return TEMPLATES.filter((t) => t.category === category);
}

type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${siteUrl}${c.path}`,
    })),
  };
}

export function templateCrumbs(t: Template): Crumb[] {
  return [
    { name: "Home", path: "/" },
    { name: "Templates", path: "/templates" },
    { name: `${categoryLabel(t.category)} website templates`, path: categoryPath(t.category) },
    { name: t.name, path: `/templates/${t.slug}` },
  ];
}

export function categoryCrumbs(category: string): Crumb[] {
  return templateCrumbs(templatesIn(category)[0]).slice(0, 3);
}

export function templateJsonLd(t: Template) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: templateHeading(t),
    description: templateDescription(t),
    url: `${siteUrl}/templates/${t.slug}`,
    image: `${siteUrl}/template-previews/${t.slug}.jpg`,
    genre: `${templateUse(t).useCase} website template`,
    isAccessibleForFree: true,
    inLanguage: "en",
    encodingFormat: "text/html",
    publisher: { "@type": "Organization", name: "ScrollCraft", url: siteUrl },
  };
}

/** Escapes "<" so copy can never close the script tag. */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
