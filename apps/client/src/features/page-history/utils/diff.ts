export type DiffType = 'add' | 'remove' | 'none';

export interface DiffResult {
  value: string;
  type: DiffType;
}

export function computeDiff(oldText: string, newText: string): DiffResult[] {
  // Split by HTML tags or words/spaces to preserve structure
  const tokenize = (text: string) => text.split(/(<[^>]+>|[\w]+|[^\w<]+)/g).filter(Boolean);

  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  const dp: number[][] = Array.from({ length: oldTokens.length + 1 }, () =>
    Array(newTokens.length + 1).fill(0)
  );

  for (let i = 1; i <= oldTokens.length; i++) {
    for (let j = 1; j <= newTokens.length; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffResult[] = [];
  let i = oldTokens.length;
  let j = newTokens.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      result.unshift({ value: oldTokens[i - 1], type: 'none' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ value: newTokens[j - 1], type: 'add' });
      j--;
    } else if (i > 0 && (j === 0 || dp[i - 1][j] > dp[i][j - 1])) {
      result.unshift({ value: oldTokens[i - 1], type: 'remove' });
      i--;
    }
  }

  // Group contiguous types, but don't merge across HTML tags if they are 'none'
  const groupedResult: DiffResult[] = [];
  if (result.length === 0) return groupedResult;

  let current = result[0];
  for (let k = 1; k < result.length; k++) {
    const item = result[k];
    const isTag = item.value.startsWith('<') && item.value.endsWith('>');

    if (item.type === current.type && !isTag && !(current.value.startsWith('<') && current.value.endsWith('>'))) {
      current.value += item.value;
    } else {
      groupedResult.push(current);
      current = item;
    }
  }
  groupedResult.push(current);

  return groupedResult;
}
