import { useIcons } from "../components/IconsContext";
import { TYPES } from "../domain/bundleTypes";
import { FALLBACK_ICON } from "../state/defaultIcons";
import { useStore } from "../state/store";

/**
 * What follows the pointer. A plain copy rather than the real item, so the
 * ghost never registers a second draggable or droppable under the same id.
 */
export function DragGhost({ elementId }: { elementId: string }) {
  const element = useStore((s) => s.elements[elementId]);
  const elements = useStore((s) => s.elements);
  const defaults = useIcons();
  if (!element) return null;
  const icon = (id: string) => elements[id]?.iconData || defaults.light || FALLBACK_ICON;

  if (element.type === "stack") {
    return (
      <div className="stack">
        <div className="stack-items">
          {(element.children ?? []).map((id) => (
            <div key={id} className="button">
              <div className="button-icon">
                <img src={icon(id)} alt="" />
              </div>
              <div className="button-name">{elements[id]?.name}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`button ${TYPES[element.type].postfix.slice(1)}`} data-testid="drag-ghost">
      <div className="button-icon">
        <img src={icon(elementId)} alt="" />
      </div>
      <div className="button-name">{element.name}</div>
    </div>
  );
}
