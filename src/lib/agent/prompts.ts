import type { GenerateRequest } from '@/types'

export function buildOrchestratorPrompt(request: GenerateRequest): string {
  return `You are an expert travel planner for TravelGenieAI, a premium AI travel planning service.

The user wants to plan a trip with these details:
- Destination: ${request.destination}
- Duration: ${request.duration_days} days
- Total budget: $${request.budget_usd} USD
- Interests: ${request.interests.length > 0 ? request.interests.join(', ') : 'general sightseeing'}
${request.dates ? `- Travel dates: ${request.dates}` : ''}
${request.group_size ? `- Group size: ${request.group_size}` : ''}
${request.extra_notes ? `- Additional notes: ${request.extra_notes}` : ''}

Your task is to produce a detailed, realistic, day-by-day travel itinerary.

Rules you MUST follow:
1. Plan exactly ${request.duration_days} days.
2. Each day must have exactly 3 slots: "morning", "afternoon", "evening".
3. Every activity must have a realistic cost estimate in USD.
4. Every slot should have a practical insider tip.
5. Include one accommodation recommendation per day with a realistic nightly cost.
6. The sum of all activity costs and accommodation costs must NOT exceed $${request.budget_usd} USD.
7. Activities must match the user's interests.
8. Use the travel dates to make the itinerary seasonal and contextual where provided.
9. Include a trip title that captures the spirit of the journey.

Return ONLY a valid JSON object with this EXACT structure. No markdown fences, no explanation, no comments — raw JSON only:

{
  "title": "string",
  "days": [
    {
      "day": 1,
      "title": "string",
      "date": "string",
      "weather": "string",
      "budget_usd": 0,
      "slots": [
        {
          "time": "morning",
          "activity": "string",
          "cost_usd": 0,
          "tip": "string"
        },
        {
          "time": "afternoon",
          "activity": "string",
          "cost_usd": 0,
          "tip": "string"
        },
        {
          "time": "evening",
          "activity": "string",
          "cost_usd": 0,
          "tip": "string"
        }
      ],
      "accommodation": {
        "name": "string",
        "cost_usd": 0
      }
    }
  ],
  "total_cost_usd": 0,
  "packing_tips": ["string"],
  "best_time_to_visit": "string"
}`
}

export function buildCriticPrompt(itinerary: string, request: GenerateRequest): string {
  return `You are a meticulous travel critic reviewing a travel itinerary for TravelGenieAI.

Original trip request:
- Destination: ${request.destination}
- Duration: ${request.duration_days} days
- Total budget: $${request.budget_usd} USD
- Interests: ${request.interests.join(', ')}

Itinerary to review:
${itinerary}

Review and fix ALL of the following issues if present:
1. BUDGET: If total_cost_usd exceeds $${request.budget_usd}, reduce activity and accommodation costs proportionally.
2. OVERLOADED DAYS: If any day has more than 4 slots/activities, remove the least important one.
3. ROUTING: If activities on the same day are geographically far apart with no logical flow, reorder them.
4. MEALS: Ensure at least one slot per day involves food or dining. If missing, replace the evening slot with a local dining experience.
5. MISSING TIPS: Every slot must have a non-empty "tip" field.

Return ONLY the corrected itinerary as a valid JSON object with the EXACT same structure. No markdown fences, no explanation — raw JSON only.`
}
