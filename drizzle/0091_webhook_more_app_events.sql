-- Webhook app events, part two: job completion, invoice created, invoice overdue,
-- and automation failure — the moments freelancers wire into Zapier/Make for
-- follow-ups, dunning, and ops alerting.
ALTER TABLE `workflowWebhookDeliveries`
  MODIFY COLUMN `eventType` ENUM(
    'app.automation.failed',
    'app.booking.created',
    'app.client.created',
    'app.invoice.created',
    'app.invoice.overdue',
    'app.invoice.paid',
    'app.job.completed',
    'app.proposal.signed',
    'job.status_changed',
    'service_visit.scheduled',
    'service_visit.status_changed'
  ) NOT NULL;
