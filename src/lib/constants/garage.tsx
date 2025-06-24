const mockToolImages = [
  "/images/mock/cordless-drill.jpg",
  "/images/mock/drill-set.jpg",
  "/images/mock/lawn-mower.jpg",
  "/images/mock/pressure-washer.jpg",
  "/images/mock/skill-saw.jpg",
  "/images/mock/ladder.jpg",
  "/images/mock/tools-pegboard.jpg",
  "/images/mock/trailer-hitch.jpg",
];

export function getMockToolImage() {
  return mockToolImages[Math.floor(Math.random() * mockToolImages.length)];
}
