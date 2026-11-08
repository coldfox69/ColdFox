import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'Background Jobs - Admin',
  description: 'Background job queue status.',
};

export default function JobsPage() {
  return (
    <AdminModulePage
      module="jobs"
      title="Background Jobs"
      description="Durable job queue executions."
      columns={[
        { key: 'id', label: 'Job ID' },
        { key: 'job_type', label: 'Job Type' },
        { key: 'status', label: 'Status' },
        { key: 'priority', label: 'Priority' },
        { key: 'run_at', label: 'Run At' },
        { key: 'created_at', label: 'Created' },
      ]}
      emptyState={{
        title: 'No jobs',
        description: 'No background jobs have been queued yet.',
      }}
    />
  );
}


