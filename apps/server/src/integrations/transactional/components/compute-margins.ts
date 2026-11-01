// MIT - https://github.com/resend/react-email/blob/react-email@6.11.6/packages/react-email/src/components/text/utils/compute-margins.ts
type MarginType = string | number | undefined;

interface MarginProperties {
  margin?: MarginType;
  marginTop?: MarginType;
  marginRight?: MarginType;
  marginBottom?: MarginType;
  marginLeft?: MarginType;
}

interface MarginResult {
  marginTop: MarginType;
  marginRight: MarginType;
  marginBottom: MarginType;
  marginLeft: MarginType;
}

function parseMarginValue(value: MarginType): MarginResult {
  if (typeof value === 'number')
    return {
      marginTop: value,
      marginBottom: value,
      marginLeft: value,
      marginRight: value,
    };

  if (typeof value === 'string') {
    const values = value.toString().trim().split(/\s+/);

    if (values.length === 1) {
      return {
        marginTop: values[0],
        marginBottom: values[0],
        marginLeft: values[0],
        marginRight: values[0],
      };
    }

    if (values.length === 2) {
      return {
        marginTop: values[0],
        marginRight: values[1],
        marginBottom: values[0],
        marginLeft: values[1],
      };
    }

    if (values.length === 3) {
      return {
        marginTop: values[0],
        marginRight: values[1],
        marginBottom: values[2],
        marginLeft: values[1],
      };
    }

    if (values.length === 4) {
      return {
        marginTop: values[0],
        marginRight: values[1],
        marginBottom: values[2],
        marginLeft: values[3],
      };
    }
  }

  return {
    marginTop: undefined,
    marginBottom: undefined,
    marginLeft: undefined,
    marginRight: undefined,
  };
}

/**
 * Parses all the values out of a margin string to get the value for all margin props in the four margin properties
 * @example e.g. "10px" =\> mt: "10px", mr: "10px", mb: "10px", ml: "10px"
 */
export function computeMargins(properties: MarginProperties): MarginResult {
  let result: MarginResult = {
    marginTop: undefined,
    marginRight: undefined,
    marginBottom: undefined,
    marginLeft: undefined,
  };

  for (const [key, value] of Object.entries(properties)) {
    if (key === 'margin') {
      result = parseMarginValue(value);
    } else if (key === 'marginTop') {
      result.marginTop = value;
    } else if (key === 'marginRight') {
      result.marginRight = value;
    } else if (key === 'marginBottom') {
      result.marginBottom = value;
    } else if (key === 'marginLeft') {
      result.marginLeft = value;
    }
  }

  return result;
}
