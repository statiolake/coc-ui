export type PickerItemDisplay = {
  text: string;
  /** Fuzzy-match character positions remapped from the source label. */
  positions?: Uint32Array;
};

/**
 * Shorten path hierarchy for display without changing the value used for
 * filtering. Components containing fuzzy-match positions are never removed,
 * and the returned positions address the shortened text.
 */
export function formatPickerItem(
  label: string,
  positions: ArrayLike<number> | undefined,
  maxWidth: number,
): PickerItemDisplay {
  const singleLine = label.replace(/\r?\n/g, " ");
  if (singleLine.length <= maxWidth) {
    return {
      text: singleLine,
      positions: positions ? Uint32Array.from(positions) : undefined,
    };
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(singleLine)) {
    return {
      text: singleLine,
      positions: positions ? Uint32Array.from(positions) : undefined,
    };
  }

  const forwardSeparators = count(singleLine, "/");
  const backwardSeparators = count(singleLine, "\\");
  const separator = forwardSeparators >= backwardSeparators ? "/" : "\\";
  if (Math.max(forwardSeparators, backwardSeparators) < 2) {
    return {
      text: singleLine,
      positions: positions ? Uint32Array.from(positions) : undefined,
    };
  }

  const compacted = compactPath(singleLine, separator, positions);
  if (compacted.text.length >= singleLine.length) {
    return {
      text: singleLine,
      positions: positions ? Uint32Array.from(positions) : undefined,
    };
  }
  return compacted;
}

function compactPath(
  label: string,
  separator: string,
  positions: ArrayLike<number> | undefined,
): PickerItemDisplay {
  const matched = new Set<number>(positions ? Array.from(positions) : []);
  const components: Array<{ text: string; start: number }> = [];
  let start = 0;
  for (let index = 0; index <= label.length; index++) {
    if (index === label.length || label[index] === separator) {
      components.push({ text: label.slice(start, index), start });
      start = index + 1;
    }
  }

  const last = components.length - 1;
  const keep = components.map((component, index) => {
    if (index === last || component.text === "") return true;
    for (
      let sourceIndex = component.start;
      sourceIndex < component.start + component.text.length;
      sourceIndex++
    ) {
      if (matched.has(sourceIndex)) return true;
    }
    // A matched separator belongs to the component immediately after it.
    return component.start > 0 && matched.has(component.start - 1);
  });

  const output: string[] = [];
  const sourceToOutput = new Map<number, number>();
  let omitted = false;
  let outputLength = 0;

  const append = (text: string, sourceStart?: number): void => {
    output.push(text);
    if (sourceStart != null) {
      for (let offset = 0; offset < text.length; offset++) {
        sourceToOutput.set(sourceStart + offset, outputLength + offset);
      }
    }
    outputLength += text.length;
  };

  for (let index = 0; index < components.length; index++) {
    if (index > 0) append(separator, components[index].start - 1);
    if (keep[index]) {
      append(components[index].text, components[index].start);
      omitted = false;
    } else if (!omitted) {
      append("..");
      omitted = true;
    } else {
      // Remove the separator already emitted for adjacent omitted components.
      output.pop();
      outputLength--;
    }
  }

  const remapped =
    positions == null
      ? undefined
      : Uint32Array.from(
          Array.from(positions, (position) => sourceToOutput.get(position)).filter(
            (position): position is number => position != null,
          ),
        );
  return { text: output.join(""), positions: remapped };
}

function count(value: string, needle: string): number {
  let total = 0;
  for (const character of value) {
    if (character === needle) total++;
  }
  return total;
}
