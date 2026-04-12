import { canPerformAction } from "../../utils/permissions";

describe("canPerformAction", () => {
  describe("owner permissions", () => {
    it("should allow owner to delete workspace", () => {
      expect(canPerformAction("owner", "delete_workspace")).toBe(true);
    });

    it("should allow owner to invite members", () => {
      expect(canPerformAction("owner", "invite_member")).toBe(true);
    });

    it("should allow owner to edit any task", () => {
      expect(canPerformAction("owner", "edit_any_task")).toBe(true);
    });
  });

  describe("admin permissions", () => {
    it("should allow admin to invite members", () => {
      expect(canPerformAction("admin", "invite_member")).toBe(true);
    });

    it("should allow admin to edit any task", () => {
      expect(canPerformAction("admin", "edit_any_task")).toBe(true);
    });

    it("should NOT allow admin to delete workspace", () => {
      expect(canPerformAction("admin", "delete_workspace")).toBe(false);
    });
  });

  describe("member permissions", () => {
    it("should allow member to create tasks", () => {
      expect(canPerformAction("member", "create_task")).toBe(true);
    });

    it("should allow member to view workspace", () => {
      expect(canPerformAction("member", "view_workspace")).toBe(true);
    });

    it("should NOT allow member to invite members", () => {
      expect(canPerformAction("member", "invite_member")).toBe(false);
    });

    it("should NOT allow member to delete workspace", () => {
      expect(canPerformAction("member", "delete_workspace")).toBe(false);
    });

    it("should NOT allow member to edit any task", () => {
      expect(canPerformAction("member", "edit_any_task")).toBe(false);
    });
  });
});
