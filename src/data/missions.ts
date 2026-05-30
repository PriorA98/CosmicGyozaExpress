import type { MissionDefinition } from "../types/mission";

export const TEA_MOON_MISSION_ID = "tea-moon";

export const teaMoonMission: MissionDefinition = {
  id: TEA_MOON_MISSION_ID,
  title: "Tea Moon Tutorial",
  routeId: "phase-1-tea-moon-test-route",
  recipientName: "Sleepy Moon Rabbit",
  deliveryItemName: "hot tea and moon mochi",
  requestText: "A tiny kettle is blinking from the moon. Someone needs tea before the stars get too loud.",
  memoryRewardId: "memory-tea-moon-postcard",
  resultLines: {
    Perfect: "The tea is still steaming politely.",
    "Slightly shaken": "The tea learned about turbulence and remained brave.",
    "Emotionally rotated": "The mochi rotated through several feelings, then settled.",
    "Warm but confused": "The package is unsure what happened, but it is warm.",
    "Still delicious": "The snack arrangement is abstract and accepted.",
    "Dramatically rearranged": "The mochi has become a small lunar sculpture.",
    "Basically fine": "Everything important survived, including dinner.",
  },
  landingLines: {
    soft: "moon-approved soft landing",
    bumpy: "spirited landing, warmly accepted",
    incident: "reassembled landing with extra steam",
  },
} as const;

export const missions = [teaMoonMission] as const;

export function getMissionById(missionId: string): MissionDefinition {
  const mission = missions.find((candidate) => candidate.id === missionId);
  if (!mission) {
    throw new Error(`Unknown mission id: ${missionId}`);
  }

  return mission;
}
