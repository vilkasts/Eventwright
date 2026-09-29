// The workflow graph: which agents exist, what each one writes, what it reads, and which gates check it.
// Typed as Dag, so a missing or misspelled agent or gate name is a compile error.
import type { Dag } from "@/types/workflow";

// The four agents that research the event itself; they share ownership of several gates.
const SERVICE_PLANNERS = ["venue-scout", "catering-planner", "entertainment-planner", "logistics-planner"] as const;

// The workflow graph is the single place that defines dependencies, artifacts, sections and gate owners.
// Agents with a service field run only if that service is in the confirmed requirements.
export const DAG: Dag = {
  // Three failures in a row are retried; the fourth stops the run.
  maxRetries: 3,
  agents: {
    // Turns the user's request and answers into numbered requirements (R-01, …) and the service list.
    "requirements-formalizer": {
      kind: "artifact",
      artifact: "01-requirements.md",
      deps: [],
      stage: "domain",
      sections: [
        "Event profile",
        "Guests",
        "Date and location",
        "Budget and currency",
        "Services needed",
        "Constraints",
        "Clarification log",
        "Requirements",
      ],
      requiredLines: ["- Date:", "- City:", "- Guests:", "- Budget:", "- Services:"],
      moneyLines: ["Budget"],
    },
    // Weather for the date and city from the Open-Meteo MCP server, ending with an outdoor verdict.
    "weather-analyst": {
      kind: "artifact",
      artifact: "02-weather-outlook.md",
      deps: ["requirements-formalizer"],
      stage: "domain",
      sections: ["Location", "Method", "Outlook", "Outdoor suitability"],
      requiredLines: ["- Method:", "- Rain risk:", "- Verdict:"],
    },
    // Three real venues and a recommendation; the facts other planners rely on (capacity, inclusions, rules).
    "venue-scout": {
      kind: "artifact",
      artifact: "03-venues.md",
      deps: ["requirements-formalizer", "weather-analyst"],
      stage: "domain",
      sections: ["Shortlist", "Recommendation", "Accessibility and logistics"],
      requiredLines: [
        "- Recommended venue:",
        "- Venue cost:",
        "- Venue capacity:",
        "- Venue includes:",
        "- Venue rules:",
        "- Public holidays:",
      ],
    },
    // Optional (service "catering"): food and drinks for the recommended venue.
    "catering-planner": {
      kind: "artifact",
      artifact: "04-catering.md",
      service: "catering",
      deps: ["requirements-formalizer", "venue-scout"],
      stage: "domain",
      sections: ["Catering option", "Menu", "Dietary coverage", "Cost"],
      requiredLines: ["- Catering cost:"],
    },
    // Optional (service "entertainment"): program, performers and a weather plan B.
    "entertainment-planner": {
      kind: "artifact",
      artifact: "05-entertainment.md",
      service: "entertainment",
      deps: ["requirements-formalizer", "weather-analyst", "venue-scout"],
      stage: "domain",
      sections: ["Program", "Vendors", "Weather plan B", "Cost"],
      requiredLines: ["- Entertainment cost:"],
    },
    // Optional (service "logistics"): transport, accessibility, rentals and booking deadlines.
    "logistics-planner": {
      kind: "artifact",
      artifact: "06-logistics.md",
      service: "logistics",
      deps: ["requirements-formalizer", "weather-analyst", "venue-scout"],
      stage: "domain",
      sections: [
        "Guest transport and parking",
        "Accessibility",
        "Rentals and decor",
        "Vendor booking timeline",
        "Cost",
      ],
      requiredLines: ["- Logistics cost:"],
    },
    // Adds up the costs of the planners that ran, plus a 10% contingency.
    "budget-aggregator": {
      kind: "artifact",
      artifact: "07-budget.md",
      deps: ["requirements-formalizer", ...SERVICE_PLANNERS],
      stage: "domain",
      sections: ["Line items", "Totals", "Savings options"],
      requiredLines: ["- Subtotal:", "- Contingency (10%):", "- Total with contingency:", "- Budget limit:"],
      moneyLines: ["Total with contingency"],
    },
    // The synthesis agent: merges all checked artifacts into one plan that the human approves.
    "event-plan-builder": {
      kind: "artifact",
      artifact: "08-event-plan.md",
      deps: ["requirements-formalizer", "weather-analyst", ...SERVICE_PLANNERS, "budget-aggregator"],
      stage: "final",
      coversRequirements: true,
      sections: [
        "Event overview",
        "Weather and plan B",
        "Venue",
        "Menu",
        "Program",
        "Run of show",
        "Preparation checklist",
        "Budget",
        "Requirements matrix",
      ],
      requiredLines: [],
    },
    // Renders the approved plan into the user-facing Markdown and HTML files.
    "html-builder": {
      kind: "output",
      outputs: ["event-plan.md", "event-plan.html"],
      deps: ["event-plan-builder"],
      stage: "output",
    },
  },
  // Each gate lists the agents that must fix it when it fails. The validator checks them; `wf record-gates`
  // applies its report and marks the failing owners (and everything built on them) for a retry.
  gates: {
    "G1-requirements-complete": { stage: "domain", owners: ["requirements-formalizer"] },
    "G2-sources-cited": { stage: "domain", owners: SERVICE_PLANNERS },
    "G3-weather-grounded": { stage: "domain", owners: ["weather-analyst"] },
    "G4-venue-fit": { stage: "domain", owners: ["venue-scout"] },
    "G5-dietary-coverage": { stage: "domain", owners: ["catering-planner"] },
    "G6-weather-plan-b": { stage: "domain", owners: ["venue-scout", "entertainment-planner", "logistics-planner"] },
    "G7-budget-within-limit": { stage: "domain", owners: [...SERVICE_PLANNERS, "budget-aggregator"] },
    "G8-currency-consistent": { stage: "domain", owners: [...SERVICE_PLANNERS, "budget-aggregator"] },
    "G9-must-haves-covered": { stage: "domain", owners: SERVICE_PLANNERS },
    "G10-plan-covers-requirements": { stage: "final", owners: ["event-plan-builder"] },
    "G11-plan-consistent-with-artifacts": { stage: "final", owners: ["event-plan-builder"] },
    "G12-timeline-feasible": { stage: "final", owners: ["event-plan-builder"] },
  },
};
