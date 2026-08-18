interface LocationFormatProps {
  suburb?: {
    name: string;
    city?: {
      name: string;
    } | null;
  } | null;
  state?: {
    name: string;
    code?: string;
  } | null;
  city?: {
    name: string;
  } | null;
  address?: string | null;
}

/**
 * Shared utility for canonical location display formatting.
 * Handles missing city or state relationships gracefully.
 */
export function formatLocation(props: LocationFormatProps): string {
  const parts: string[] = [];

  // Address if provided (for property pages)
  if (props.address) {
    parts.push(props.address);
  }

  // Suburb Name
  if (props.suburb?.name) {
    parts.push(props.suburb.name);
  }

  // City Name (from suburb relation or direct)
  const cityName = props.suburb?.city?.name || props.city?.name;
  if (cityName && (!props.suburb?.name || cityName !== props.suburb.name)) {
    parts.push(cityName);
  }

  // State Name
  if (props.state?.name) {
    parts.push(props.state.name);
  } else if (props.state?.code) {
    parts.push(props.state.code);
  }

  // Remove exact duplicate adjacent parts (e.g., "Sydney, Sydney")
  const uniqueParts = parts.filter((part, index) => {
    return index === 0 || part.toLowerCase() !== parts[index - 1].toLowerCase();
  });

  return uniqueParts.join(', ');
}
