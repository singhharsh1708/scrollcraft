import { NextRequest, NextResponse } from "next/server";

interface Section {
  id: string;
  heading?: string;
  body?: string;
  eyebrow?: string;
  ctaLabel?: string;
  ctaHref?: string;
  accentColor?: string;
  headingColor?: string;
  bodyColor?: string;
  scrollHeight?: number;
  textAlign?: string;
}

export async function POST(req: NextRequest) {
  const { message, sections, selectedSectionId } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Demo fallback — rule-based edits
    return demoEdit(message, sections, selectedSectionId);
  }

  const selectedSection = sections.find((s: Section) => s.id === selectedSectionId);

  const systemPrompt = `You are an AI assistant helping a user edit their scroll website sections.
Current selected section: ${JSON.stringify(selectedSection, null, 2)}
All sections: ${JSON.stringify(sections, null, 2)}

The user will ask you to edit the website. You MUST respond with valid JSON in this exact format:
{
  "message": "Brief friendly description of what you changed",
  "updates": [
    { "id": "section-id", "field": "heading", "value": "New value" },
    ...
  ]
}

Valid fields: heading, body, eyebrow, ctaLabel, ctaHref, accentColor, headingColor, bodyColor, scrollHeight, textAlign
For colors use hex values. For textAlign use "left", "center", or "right".
Only include updates that actually change something. Keep edits focused and relevant.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch {
    return demoEdit(message, sections, selectedSectionId);
  }
}

function demoEdit(message: string, sections: Section[], selectedSectionId: string) {
  const lower = message.toLowerCase();
  const section = sections.find((s: Section) => s.id === selectedSectionId) || sections[0];
  if (!section) return NextResponse.json({ message: "No section selected", updates: [] });

  const updates: { id: string; field: string; value: string | number }[] = [];
  let reply = "";

  if (lower.includes("purple") || lower.includes("violet")) {
    updates.push({ id: section.id, field: "accentColor", value: "#a78bfa" });
    updates.push({ id: section.id, field: "headingColor", value: "#ffffff" });
    reply = "Switched to a purple color scheme.";
  } else if (lower.includes("blue")) {
    updates.push({ id: section.id, field: "accentColor", value: "#60a5fa" });
    reply = "Applied a blue accent.";
  } else if (lower.includes("green") || lower.includes("emerald")) {
    updates.push({ id: section.id, field: "accentColor", value: "#34d399" });
    reply = "Applied an emerald green accent.";
  } else if (lower.includes("bigger") || lower.includes("taller") || lower.includes("more scroll")) {
    updates.push({ id: section.id, field: "scrollHeight", value: (section.scrollHeight || 1000) + 500 });
    reply = "Increased the scroll height of this section.";
  } else if (lower.includes("smaller") || lower.includes("shorter")) {
    updates.push({ id: section.id, field: "scrollHeight", value: Math.max(300, (section.scrollHeight || 1000) - 400) });
    reply = "Reduced the scroll height.";
  } else if (lower.includes("center")) {
    updates.push({ id: section.id, field: "textAlign", value: "center" });
    reply = "Centered the text alignment.";
  } else if (lower.includes("left align")) {
    updates.push({ id: section.id, field: "textAlign", value: "left" });
    reply = "Left-aligned the text.";
  } else if (lower.includes("heading") || lower.includes("title")) {
    const match = message.match(/(?:heading|title)[^\w"']*["']?([^"'\n]+)["']?/i);
    if (match) {
      updates.push({ id: section.id, field: "heading", value: match[1].trim() });
      reply = `Updated the heading to "${match[1].trim()}".`;
    } else {
      reply = "To change the heading, say something like: 'Set the heading to Your New Title'";
    }
  } else if (lower.includes("cta") || lower.includes("button")) {
    const match = message.match(/(?:cta|button)[^\w"']*["']?([^"'\n]+)["']?/i);
    if (match) {
      updates.push({ id: section.id, field: "ctaLabel", value: match[1].trim() });
      reply = `Updated the CTA button to "${match[1].trim()}".`;
    } else {
      reply = "To change the button text, say: 'Set the CTA to Get Started'";
    }
  } else {
    reply = "I can help you change colors, text alignment, scroll height, headings, and button labels. Try: 'Make it purple', 'Center the text', 'Make the section taller'.";
  }

  return NextResponse.json({ message: reply, updates });
}
