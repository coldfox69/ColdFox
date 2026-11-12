import { withApi, ok, parseBody, requireApiSession, writeAudit, assertRole, ApiError } from '@/lib/http';
import { automationUpdateSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/** Update an automation workflow of this workspace. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/automations/[id]', method: 'PATCH' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    const { id } = await params;
    const body = await parseBody(request, automationUpdateSchema);
    const db = createServiceClient();

    const { data: workflow } = await db
      .from('automation_workflows')
      .select('id, status, name')
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .maybeSingle();
    if (!workflow) throw new ApiError(404, 'Automation not found.', 'not_found');

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status) patch.status = body.status;
    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;

    const { data, error } = await db
      .from('automation_workflows')
      .update(patch)
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .select('id, name, status')
      .single();
    if (error || !data) throw new ApiError(500, 'Could not update the automation.');

    await writeAudit({
      organizationId: session.organizationId,
      actorId: session.userId,
      actorEmail: session.email,
      action: 'automation.updated',
      entityType: 'automation_workflow',
      entityId: id,
      request,
      metadata: { before: workflow.status, after: data.status },
    });

    return ok({ id: data.id, name: data.name, status: data.status });
  });
}

/** Remove an automation workflow of this workspace. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/automations/[id]', method: 'DELETE' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    const { id } = await params;
    const db = createServiceClient();

    const { data: workflow } = await db
      .from('automation_workflows')
      .select('id, name')
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .maybeSingle();
    if (!workflow) throw new ApiError(404, 'Automation not found.', 'not_found');

    const { error } = await db.from('automation_workflows').delete().eq('id', id).eq('organization_id', session.organizationId);
    if (error) throw new ApiError(500, 'Could not remove the automation.');

    await writeAudit({
      organizationId: session.organizationId,
      actorId: session.userId,
      actorEmail: session.email,
      action: 'automation.deleted',
      entityType: 'automation_workflow',
      entityId: id,
      request,
      metadata: { name: workflow.name },
    });

    return ok({ deleted: true });
  });
}
