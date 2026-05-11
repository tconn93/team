// Example mission prompts for quick testing
export const exampleMissions = [
  {
    id: 'm1',
    title: 'Launch a new SaaS product in Europe',
    prompt: 'Develop a complete go-to-market strategy for a new AI-powered productivity tool targeting the European market. Include market research, financial projections, and visual assets.',
  },
  {
    id: 'm2',
    title: 'Competitive analysis for AI coding tools',
    prompt: 'Perform a deep competitive analysis of Cursor, Windsurf, and other AI coding assistants. Identify strengths, weaknesses, market gaps, and recommend differentiation strategies.',
  },
  {
    id: 'm3',
    title: 'Financial model for startup fundraising',
    prompt: 'Build a 3-year financial model for a Series A AI startup targeting $5M ARR. Include revenue streams, burn rate, unit economics, and pitch deck visuals.',
  },
];

export function getRandomMission() {
  return exampleMissions[Math.floor(Math.random() * exampleMissions.length)];
}
