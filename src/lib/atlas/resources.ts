import {
  compare,
  diseaseMap,
  edgeMap,
  nodeMap,
  pairs,
  sourceMap,
  strongestPaths,
  type Edge,
} from './graph';

export type ResourceCategory =
  | 'patient-education'
  | 'research'
  | 'clinical-trial'
  | 'patient-organization'
  | 'regulatory'
  | 'other';

export type AtlasResource = {
  id: string;
  title: string;
  url: string | null;
  sourceType: string;
  category: ResourceCategory;
  diseaseIds: string[];
  nodeIds: string[];
  edgeIds: string[];
  connectionIds: string[];
  whyRelevant: string;
  supportsBothDiseases: boolean;
  supportsStrongPath: boolean;
  isDemo: boolean;
};

export type SharedResearchAsset = {
  id: string;
  label: string;
  type: string;
  description: string;
  diseaseIds: string[];
  edgeIds: string[];
  sourceIds: string[];
  sourceUrls: string[];
  whyRelevant: string;
};

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function categoryFromSourceType(type: string): ResourceCategory {
  const value = type.toLowerCase();

  if (value.includes('clinicaltrials.gov')) return 'clinical-trial';
  if (value.includes('patient organization')) return 'patient-organization';
  if (value.includes('clinical reference') || value.includes('gene reference')) return 'patient-education';
  if (value.includes('regulatory')) return 'regulatory';
  if (value.includes('study') || value.includes('review') || value.includes('experimental')) return 'research';

  return 'other';
}

function getPairOrThrow(pairId: string) {
  const pair = pairs.find((p) => p.id === pairId);
  if (!pair) throw new Error(`Unknown Atlas pair: ${pairId}`);
  return pair;
}

function pairEdges(pairId: string): Edge[] {
  const pair = getPairOrThrow(pairId);
  return [
    ...diseaseMap[pair.a]!.edges,
    ...diseaseMap[pair.b]!.edges,
  ];
}

export function getResourcesForPair(
  pairId: string = 'gm2',
): AtlasResource[] {
  const pair = getPairOrThrow(pairId);
  const comparison = compare(pair.a, pair.b);
  const allEdges = pairEdges(pairId);

  const strongEdgeIds = new Set(
    strongestPaths(comparison)
      .slice(0, 8)
      .flatMap((feature) => [
        ...feature.pathA,
        ...feature.pathB,
      ]),
  );

  const sourceIds = unique(
    allEdges.flatMap((edge) => [
      ...edge.sourceIds,
      ...edge.contradictions.map(
        (contradiction) => contradiction.sourceId,
      ),
    ]),
  );

  const resources = sourceIds
    .map((sourceId): AtlasResource | null => {
      const source = sourceMap[sourceId];
      if (!source) return null;

      const supportingEdges = allEdges.filter(
        (edge) =>
          edge.sourceIds.includes(sourceId) ||
          edge.contradictions.some(
            (contradiction) =>
              contradiction.sourceId === sourceId,
          ),
      );

      const diseaseIds = unique(
        supportingEdges.map((edge) => edge.disease),
      );

      const nodeIds = unique(
        supportingEdges.flatMap((edge) => [
          edge.source,
          edge.target,
        ]),
      );

      const edgeIds = supportingEdges.map(
        (edge) => edge.id,
      );

      const supportsBothDiseases =
        diseaseIds.includes(pair.a) &&
        diseaseIds.includes(pair.b);

      const supportsStrongPath = supportingEdges.some(
        (edge) => strongEdgeIds.has(edge.id),
      );

      let whyRelevant = '';

      if (supportsBothDiseases && supportsStrongPath) {
        whyRelevant =
          `This source supports evidence in both ${diseaseMap[pair.a]!.short} and ${diseaseMap[pair.b]!.short} and contributes to one of the strongest shared Atlas paths.`;
      } else if (supportsBothDiseases) {
        whyRelevant =
          `This source supports evidence used in both ${diseaseMap[pair.a]!.short} and ${diseaseMap[pair.b]!.short}.`;
      } else if (supportsStrongPath) {
        whyRelevant =
          `This source supports the ${(diseaseIds[0] !== undefined ? diseaseMap[diseaseIds[0]]?.short : undefined) ?? 'disease'} side of a strong shared Atlas connection.`;
      } else {
        whyRelevant =
          `This source supports evidence represented in the ${pair.label} comparison.`;
      }

      return {
        id: source.id,
        title: source.title,
        url: source.url ?? null,
        sourceType: source.type,
        category: categoryFromSourceType(
          source.type,
        ),
        diseaseIds,
        nodeIds,
        edgeIds,
        connectionIds: [pair.id],
        whyRelevant,
        supportsBothDiseases,
        supportsStrongPath,
        isDemo: false,
      };
    })
    .filter(
      (resource): resource is AtlasResource =>
        resource !== null,
    );

  return resources.sort((a, b) => {
    if (
      a.supportsBothDiseases !== b.supportsBothDiseases
    ) {
      return Number(b.supportsBothDiseases) -
        Number(a.supportsBothDiseases);
    }

    if (a.supportsStrongPath !== b.supportsStrongPath) {
      return Number(b.supportsStrongPath) -
        Number(a.supportsStrongPath);
    }

    return a.title.localeCompare(b.title);
  });
}

export function getSharedResearchAssets(
  pairId: string = 'gm2',
): SharedResearchAsset[] {
  const pair = getPairOrThrow(pairId);
  const comparison = compare(pair.a, pair.b);

  return comparison.shared
    .filter(
      (feature) =>
        nodeMap[feature.id]?.dimension === 'assets',
    )
    .map((feature): SharedResearchAsset => {
      const node = nodeMap[feature.id]!;

      const edgeIds = unique([
        ...feature.pathA,
        ...feature.pathB,
      ]);

      const sourceIds = unique(
        edgeIds.flatMap((edgeId) => {
          const edge = edgeMap[edgeId];
          if (!edge) return [];

          return [
            ...edge.sourceIds,
            ...edge.contradictions.map(
              (contradiction) =>
                contradiction.sourceId,
            ),
          ];
        }),
      );

      const sourceUrls = sourceIds
        .map((sourceId) => sourceMap[sourceId]?.url)
        .filter(
          (url): url is string => Boolean(url),
        );

      return {
        id: node.id,
        label: node.label,
        type: node.type,
        description: node.description,
        diseaseIds: [pair.a, pair.b],
        edgeIds,
        sourceIds,
        sourceUrls,
        whyRelevant:
          `${node.label} appears in both ${diseaseMap[pair.a]!.short} and ${diseaseMap[pair.b]!.short} evidence paths. This makes it a candidate shared research asset, but usefulness still needs disease-specific validation.`,
      };
    });
}

export function getAtlasConnectionSummary(
  pairId: string = 'gm2',
) {
  const pair = getPairOrThrow(pairId);
  const comparison = compare(pair.a, pair.b);

  return {
    id: pair.id,
    label: pair.label,
    diseaseA: {
      id: pair.a,
      name: diseaseMap[pair.a]!.name,
      short: diseaseMap[pair.a]!.short,
    },
    diseaseB: {
      id: pair.b,
      name: diseaseMap[pair.b]!.name,
      short: diseaseMap[pair.b]!.short,
    },
    similarityIndex: comparison.overall,
    sharedFeatures: comparison.shared.map(
      (feature) => ({
        id: feature.id,
        label: nodeMap[feature.id]?.label,
        dimension:
          nodeMap[feature.id]?.dimension,
      }),
    ),
    strongestSharedFeature: comparison.strongest
      ? {
          id: comparison.strongest.id,
          label:
            nodeMap[comparison.strongest.id]?.label,
          dimension:
            nodeMap[comparison.strongest.id]
              ?.dimension,
        }
      : null,
  };
}