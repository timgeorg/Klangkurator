/**
 * The line a relationship type draws (issue #81).
 *
 * The type list carries the user's colour and both-ways mark, so the line is
 * derived rather than fixed: the type's own colour, solid when the type is
 * one-way and dotted when it reads the same from both tracks, and the
 * transition line heavier than every other. A pair shares one colour, so the
 * two readings of one fact draw alike (REQ-14-RD VC10, VC16 to VC19).
 */

import {
  isTransitionType,
  relationshipTypeBothWays,
  relationshipTypeColor,
  relationshipTypeName,
} from "@/lib/relationshipTypes";

export interface RelationshipStyle {
  /** The type's name, as Settings shows it. */
  label: string;
  /** Palette colour; null means the foreground colour (transitions). */
  color: string | null;
  /** Canvas/SVG dash pattern in px; empty = solid. */
  dash: number[];
  width: number;
}

/** The transition line's weight: heavier than every other line (VC18). */
const TRANSITION_WIDTH = 2.5;
/** A both-ways line is dotted and a touch heavier than a plain solid one. */
const BOTH_WAYS_WIDTH = 2;
const ONE_WAY_WIDTH = 1.5;
const BOTH_WAYS_DASH = [1.5, 4];

/**
 * The line one relationship type draws.
 *
 * @param typeId - The type id a relationship stores.
 * @returns Its colour, dash and weight.
 */
export function relationshipStyle(typeId: string): RelationshipStyle {
  const bothWays = relationshipTypeBothWays(typeId);
  return {
    label: relationshipTypeName(typeId),
    color: relationshipTypeColor(typeId),
    dash: bothWays ? BOTH_WAYS_DASH : [],
    width: isTransitionType(typeId) ? TRANSITION_WIDTH : bothWays ? BOTH_WAYS_WIDTH : ONE_WAY_WIDTH,
  };
}
