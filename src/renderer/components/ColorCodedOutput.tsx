import React from 'react';

interface ColorCodedOutputProps {
  content: string;
  className?: string;
}

interface ANSIColor {
  foreground?: string;
  background?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

interface ParsedSegment {
  text: string;
  style: ANSIColor;
}

// ANSI escape code patterns
const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

// ANSI color mappings
const ANSI_COLORS: Record<number, string> = {
  // Standard colors
  30: '#000000', // black
  31: '#ff6b6b', // red
  32: '#51cf66', // green
  33: '#ffd43b', // yellow
  34: '#74c0fc', // blue
  35: '#d084ff', // magenta
  36: '#3bc9db', // cyan
  37: '#ffffff', // white

  // Bright colors
  90: '#6c757d', // bright black (gray)
  91: '#ff8787', // bright red
  92: '#69db7c', // bright green
  93: '#ffec99', // bright yellow
  94: '#91a7ff', // bright blue
  95: '#e599f7', // bright magenta
  96: '#66d9ef', // bright cyan
  97: '#ffffff', // bright white
};

const ANSI_BG_COLORS: Record<number, string> = {
  // Background colors
  40: '#000000', // black
  41: '#ff6b6b', // red
  42: '#51cf66', // green
  43: '#ffd43b', // yellow
  44: '#74c0fc', // blue
  45: '#d084ff', // magenta
  46: '#3bc9db', // cyan
  47: '#ffffff', // white

  // Bright background colors
  100: '#6c757d', // bright black (gray)
  101: '#ff8787', // bright red
  102: '#69db7c', // bright green
  103: '#ffec99', // bright yellow
  104: '#91a7ff', // bright blue
  105: '#e599f7', // bright magenta
  106: '#66d9ef', // bright cyan
  107: '#ffffff', // bright white
};

// Log level patterns for semantic coloring
const LOG_PATTERNS = [
  {
    pattern: /\b(error|err|failed|failure|exception|fatal|panic)\b/gi,
    className: 'log-error',
    color: '#ff6b6b'
  },
  {
    pattern: /\b(warning|warn|deprecated|caution)\b/gi,
    className: 'log-warning',
    color: '#ffd43b'
  },
  {
    pattern: /\b(success|successful|completed|done|finished|ok|passed)\b/gi,
    className: 'log-success',
    color: '#51cf66'
  },
  {
    pattern: /\b(info|information|notice|note)\b/gi,
    className: 'log-info',
    color: '#74c0fc'
  },
  {
    pattern: /\b(debug|trace|verbose)\b/gi,
    className: 'log-debug',
    color: '#6c757d'
  },
  {
    pattern: /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2}|Z)?/g,
    className: 'log-timestamp',
    color: '#6c757d'
  },
  {
    pattern: /\d{2}:\d{2}:\d{2}(\.\d{3})?/g,
    className: 'log-time',
    color: '#6c757d'
  }
];

// URL pattern for making links clickable
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

// Parse ANSI escape codes
function parseANSI(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let currentStyle: ANSIColor = {};
  let lastIndex = 0;
  let match;

  // Reset regex
  ANSI_REGEX.lastIndex = 0;

  while ((match = ANSI_REGEX.exec(text)) !== null) {
    // Add text before the escape code
    if (match.index > lastIndex) {
      const textSegment = text.substring(lastIndex, match.index);
      if (textSegment) {
        segments.push({ text: textSegment, style: { ...currentStyle } });
      }
    }

    // Parse the escape code
    const codes = match[1].split(';').map(Number).filter(n => !isNaN(n));

    for (const code of codes) {
      if (code === 0) {
        // Reset all styles
        currentStyle = {};
      } else if (code === 1) {
        currentStyle.bold = true;
      } else if (code === 2) {
        currentStyle.dim = true;
      } else if (code === 3) {
        currentStyle.italic = true;
      } else if (code === 4) {
        currentStyle.underline = true;
      } else if (code === 22) {
        currentStyle.bold = false;
        currentStyle.dim = false;
      } else if (code === 23) {
        currentStyle.italic = false;
      } else if (code === 24) {
        currentStyle.underline = false;
      } else if (ANSI_COLORS[code]) {
        currentStyle.foreground = ANSI_COLORS[code];
      } else if (ANSI_BG_COLORS[code]) {
        currentStyle.background = ANSI_BG_COLORS[code];
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      segments.push({ text: remainingText, style: { ...currentStyle } });
    }
  }

  return segments;
}

// Apply semantic highlighting to text
function applySemanticHighlighting(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  const matches: Array<{ start: number; end: number; className: string; color: string }> = [];

  // Find all pattern matches
  for (const logPattern of LOG_PATTERNS) {
    const regex = new RegExp(logPattern.pattern.source, logPattern.pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        className: logPattern.className,
        color: logPattern.color
      });
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (keep the first one)
  const nonOverlappingMatches = matches.filter((match, index) => {
    if (index === 0) return true;
    return match.start >= matches[index - 1].end;
  });

  // Build elements with highlighting
  let elementKey = 0;
  for (const match of nonOverlappingMatches) {
    // Add text before the match
    if (match.start > lastIndex) {
      const beforeText = text.substring(lastIndex, match.start);
      elements.push(<span key={elementKey++}>{beforeText}</span>);
    }

    // Add the highlighted match
    const matchText = text.substring(match.start, match.end);
    elements.push(
      <span
        key={elementKey++}
        className={match.className}
        style={{ color: match.color }}
      >
        {matchText}
      </span>
    );

    lastIndex = match.end;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    elements.push(<span key={elementKey++}>{remainingText}</span>);
  }

  return elements.length > 0 ? elements : [text];
}

// Make URLs clickable
function linkifyUrls(elements: React.ReactNode[]): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let elementKey = 1000; // Start with high number to avoid conflicts

  elements.forEach((element, index) => {
    if (typeof element === 'string') {
      const urlMatches = element.split(URL_PATTERN);
      urlMatches.forEach((part, partIndex) => {
        if (URL_PATTERN.test(part)) {
          result.push(
            <a
              key={`${elementKey++}-${index}-${partIndex}`}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="output-link"
            >
              {part}
            </a>
          );
        } else if (part) {
          result.push(<span key={`${elementKey++}-${index}-${partIndex}`}>{part}</span>);
        }
      });
    } else {
      result.push(element);
    }
  });

  return result;
}

export const ColorCodedOutput: React.FC<ColorCodedOutputProps> = ({ content, className = '' }) => {
  const renderContent = () => {
    if (!content) return null;

    const lines = content.split('\n');

    return lines.map((line, lineIndex) => {
      if (!line.trim()) {
        return <div key={lineIndex} className="output-line empty-line">&nbsp;</div>;
      }

      // Parse ANSI codes first
      const ansiSegments = parseANSI(line);

      // Process each segment
      const processedElements: React.ReactNode[] = [];

      ansiSegments.forEach((segment, segmentIndex) => {
        // Apply semantic highlighting to the text
        const highlightedElements = applySemanticHighlighting(segment.text);

        // Wrap in ANSI style if needed
        if (segment.style.foreground || segment.style.background || segment.style.bold || segment.style.dim || segment.style.italic || segment.style.underline) {
          const ansiStyle: React.CSSProperties = {};

          if (segment.style.foreground) ansiStyle.color = segment.style.foreground;
          if (segment.style.background) ansiStyle.backgroundColor = segment.style.background;
          if (segment.style.bold) ansiStyle.fontWeight = 'bold';
          if (segment.style.dim) ansiStyle.opacity = 0.6;
          if (segment.style.italic) ansiStyle.fontStyle = 'italic';
          if (segment.style.underline) ansiStyle.textDecoration = 'underline';

          processedElements.push(
            <span key={segmentIndex} style={ansiStyle}>
              {highlightedElements}
            </span>
          );
        } else {
          processedElements.push(
            <span key={segmentIndex}>
              {highlightedElements}
            </span>
          );
        }
      });

      // Make URLs clickable
      const finalElements = linkifyUrls(processedElements);

      return (
        <div key={lineIndex} className="output-line">
          {finalElements}
        </div>
      );
    });
  };

  return (
    <div className={`color-coded-output ${className}`}>
      {renderContent()}
    </div>
  );
};
