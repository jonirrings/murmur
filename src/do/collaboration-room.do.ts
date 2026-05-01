// Placeholder - will be implemented in Phase 4
export class CollaborationRoomDO implements DurableObject {
  constructor(_ctx: DurableObjectState, _env: unknown) {}

  async fetch(_request: Request): Promise<Response> {
    return new Response("Not implemented", { status: 501 });
  }

  async alarm(): Promise<void> {}
}
