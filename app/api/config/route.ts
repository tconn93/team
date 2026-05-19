import { DEFAULT_MODEL, FAST_MODEL, EXPERT_MODEL } from '@/lib/models';

export async function GET() {
  return Response.json({
    models: {
      default: DEFAULT_MODEL,
      fast: FAST_MODEL,
      expert: EXPERT_MODEL,
    },
    memawiExtractConsolid: process.env.MEMAWI_EXTRACT_CONSOLID === 'true',
  });
}