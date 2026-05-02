import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { SetupService } from "../setup.service";

const mockUserRepo = {
  countAdmins: vi.fn(),
};

vi.mock("@/db/repositories/user.repo", () => ({
  UserRepo: function (_db?: any) {
    return mockUserRepo;
  },
}));

describe("SetupService", () => {
  let service: SetupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SetupService({} as any);
    (service as any).userRepo = mockUserRepo;
  });

  describe("isSetupComplete", () => {
    it("returns true when admin exists", async () => {
      mockUserRepo.countAdmins.mockResolvedValue(1);
      const result = await service.isSetupComplete();
      expect(result).toBe(true);
    });

    it("returns false when no admin exists", async () => {
      mockUserRepo.countAdmins.mockResolvedValue(0);
      const result = await service.isSetupComplete();
      expect(result).toBe(false);
    });

    it("returns true when multiple admins exist", async () => {
      mockUserRepo.countAdmins.mockResolvedValue(3);
      const result = await service.isSetupComplete();
      expect(result).toBe(true);
    });
  });
});
