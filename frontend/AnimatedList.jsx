import { useEffect, useRef } from "react";
import "./AnimatedList.css";

export default function AnimatedList({
  items = [],
  children,
  renderItem,
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  displayScrollbar = true,
  className = "",
}) {
  const itemRefs = useRef([]);
  const listRef = useRef(null);

  useEffect(() => {
    if (!enableArrowNavigation) return undefined;
    const list = listRef.current;
    if (!list) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
      const nextIndex = event.key === "ArrowDown"
        ? Math.min(currentIndex + 1, items.length - 1)
        : Math.max(currentIndex - 1, 0);
      itemRefs.current[nextIndex]?.focus();
    };
    list.addEventListener("keydown", onKeyDown);
    return () => list.removeEventListener("keydown", onKeyDown);
  }, [enableArrowNavigation, items.length]);

  return (
    <div
      ref={listRef}
      className={`animated-list${displayScrollbar ? "" : " animated-list--hide-scrollbar"}${className ? ` ${className}` : ""}`}
      tabIndex={enableArrowNavigation ? 0 : undefined}
      role="list"
    >
      {showGradients && <div className="animated-list__gradient animated-list__gradient--top" aria-hidden="true" />}
      <div className="animated-list__items">
        {items.map((item, index) => (
          <div
            key={item?.id || item?.filePath || item?.path || item?.title || item?.name || index}
            ref={(element) => { itemRefs.current[index] = element; }}
            className="animated-list__item"
            style={{ "--animated-list-index": index }}
            tabIndex={enableArrowNavigation ? 0 : undefined}
            role="listitem"
            onClick={() => onItemSelect?.(item, index)}
          >
            {renderItem ? renderItem(item, index) : typeof children === "function" ? children(item, index) : item}
          </div>
        ))}
      </div>
      {showGradients && <div className="animated-list__gradient animated-list__gradient--bottom" aria-hidden="true" />}
    </div>
  );
}
