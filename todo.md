
- allow multiple plane gestures to run in the same mapped area
- add some notion of "start time" to gesture so newer gestures can draw on top of older ones
- when adding shader effects to this, have each plane render to it's own canvas 
  (or, in sequence on the same canvas), so you can have a diff render texture_shader fx
  for each plane, and then clip the final result to the plane's bounds, allowing shader-based
  fill effects that are cleanly projection mapped
- set up all mapping state + fill animation state using vue/pinia so you can fully live edit
  the mapping and assign/tweak/creation fill animations without dealing with in-browser livecoding complexities