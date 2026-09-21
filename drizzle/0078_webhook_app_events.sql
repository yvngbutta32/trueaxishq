-- Webhook app events: extend the delivery event type enum with business
-- moment events (app.*) so a single signed endpoint pipeline serves both
-- internal workflow automations and external app-event integrations.
ALTER TABLE `workflowWebhookDeliveries`
  MODIFY COLUMN `eventType` ENUM(
    'app.booking.created',
    'app.client.created',
    'app.invoice.paid',
    'app.proposal.signed',
    'job.status_changed',
    'service_visit.scheduled',
    'service_visit.status_changed'
  ) NOT NULL;
