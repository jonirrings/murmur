import type { Database } from "@/db/client";
import { UserRepo } from "@/db/repositories/user.repo";

export class SetupService {
  private userRepo: UserRepo;

  constructor(db: Database) {
    this.userRepo = new UserRepo(db);
  }

  /** Check whether OOBE setup has been completed (admin exists) */
  async isSetupComplete(): Promise<boolean> {
    const count = await this.userRepo.countAdmins();
    return count > 0;
  }
}
