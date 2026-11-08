// The JSON Schema of an extension spec, generated from the bundle type table
// so it can never disagree with what the builder accepts. Published at
// /api/extension.schema.json and used as the input schema of the agent tools.

import { FIELDS, type FieldKey, ORDER, TYPES, type TypeId } from "../domain/bundleTypes";
import { EXAMPLE_SPEC, SCHEMA_PATH, SPEC_VERSION, specKeysOf } from "./spec";

type Schema = Record<string, unknown>;

const NAME: Schema = {
  type: "string",
  minLength: 1,
  description:
    "Folder name. Unique among its siblings, ignoring case; characters a folder name can't hold are replaced.",
};

function fieldSchema(key: FieldKey): Schema {
  const def = FIELDS[key];
  const description = `${def.label}. ${def.help}`;
  switch (def.input) {
    case "bool":
      return { type: "boolean", description };
    case "year":
      return {
        type: "integer",
        enum: (def.options ?? [])
          .map((o) => o.value)
          .filter(Boolean)
          .map(Number),
        description,
      };
    case "select":
      return { type: "string", enum: (def.options ?? []).map((o) => o.value), description };
    case "url":
      return { type: "string", description };
    default:
      if (key === "members") {
        return {
          description: `${description} A YAML list, or the same as objects.`,
          oneOf: [
            { type: "string" },
            {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["id", "text"],
                properties: {
                  id: { type: "string" },
                  text: { type: "string" },
                  icon: { type: "string" },
                  tooltip: { type: "string" },
                  group: { type: "string" },
                },
                additionalProperties: false,
              },
            },
          ],
        };
      }
      return { type: "string", description };
  }
}

const PNG = {
  type: "string",
  pattern: "^data:image/png;base64,",
  description: "A PNG as a data URL, ideally 96x96. Absent: the pyRevit icon.",
};

function bundleSchema(type: TypeId): Schema {
  const def = TYPES[type];
  const properties: Schema = {
    type: {
      const: type,
      description: `${def.label} (${def.postfix} folder).${def.help ? ` ${def.help}` : ""}`,
    },
    name: NAME,
    title: {
      type: "string",
      description: "Text under the icon; \\n breaks the line. Default: the name.",
    },
    tooltip: { type: "string", description: "Shown when hovering the button." },
  };
  for (const key of specKeysOf(type)) {
    if (key === "script") {
      properties.script = {
        type: "string",
        description:
          "Python for script.py (IronPython or CPython, pyRevit API). Absent: a starter script.",
      };
    } else if (key === "icon" || key === "icon_dark") {
      properties[key] = {
        ...PNG,
        description: `${key === "icon" ? "Light" : "Dark theme"} icon. ${PNG.description}`,
      };
    } else if (key === "icon_on") {
      properties.icon_on = { ...PNG, description: "The icon while the toggle is on." };
    } else if (key === "items") {
      properties.items = {
        type: "array",
        ...(def.maxChildren ? { maxItems: def.maxChildren } : {}),
        ...(def.minChildren ? { minItems: def.minChildren } : {}),
        items: { oneOf: def.accepts.map((id) => ({ $ref: `#/$defs/${id}` })) },
        description: `The bundles inside, in order. Allowed: ${def.accepts.join(", ")}.`,
      };
    } else {
      properties[key] = fieldSchema(key as FieldKey);
    }
  }
  return {
    type: "object",
    title: def.label,
    required: ["type", "name", ...(def.required ?? []), ...(def.container ? ["items"] : [])],
    properties,
    additionalProperties: false,
  };
}

/** Types a panel can hold (all but No Button, which is only for menus). */
const PANEL_TYPES = ORDER.filter((id) => id !== "nobutton");

export function extensionSchema(origin = "https://builder.pyrevitlabs.io"): Schema {
  const $defs: Schema = {};
  for (const id of ORDER) $defs[id] = bundleSchema(id);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${origin}/${SCHEMA_PATH}`,
    title: "pyRevit extension",
    description:
      "A pyRevit extension for the pyRevit Extension Builder: tabs, holding panels, holding bundles (buttons, stacks, pulldowns...). Open it in the builder with #spec=<URL-encoded JSON>, or load it as a file there.",
    type: "object",
    required: ["name", "tabs"],
    properties: {
      $schema: { type: "string" },
      version: { const: SPEC_VERSION },
      name: { ...NAME, description: "Extension name; the folder becomes <name>.extension." },
      tabs: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["name", "panels"],
          properties: {
            name: { ...NAME, description: "Ribbon tab name." },
            panels: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["name", "items"],
                properties: {
                  name: { ...NAME, description: "Panel name, shown under its buttons." },
                  items: {
                    type: "array",
                    items: { oneOf: PANEL_TYPES.map((id) => ({ $ref: `#/$defs/${id}` })) },
                  },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
    $defs,
    examples: [EXAMPLE_SPEC],
  };
}
