"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Mail, Save, Eye, Loader2, ToggleLeft, ToggleRight,
  Send, Code, FileText, AlertCircle, CheckCircle2,
  RefreshCw, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  subject: string;
  body_html: string;
  body_text: string;
  enabled: boolean;
  category: string;
  variables: string[];
}

const SAMPLE_DATA: Record<string, Record<string, string>> = {
  photo_purchased: { name: "John Doe", email: "john@example.com", package_type: "Premium", amount: "25.00", queue_position: "5", estimated_wait: "12" },
  photo_displayed: { name: "Jane Smith", email: "jane@example.com", screenshot_url: "https://example.com/screenshot.jpg", duration_seconds: "30" },
  merch_order_confirmation: { name: "Mike Wilson", email: "mike@example.com", order_number: "ORD-001", items: "T-Shirt, Mug", amount: "45.00" },
  merch_shipped: { name: "Sarah Lee", email: "sarah@example.com", order_number: "ORD-001", tracking_number: "1Z999AA10123456784", tracking_url: "https://track.example.com/123" },
  grand_prize_winner: { name: "Lucky Winner", email: "winner@example.com" },
};

const renderPreview = (html: string, vars: Record<string, string>) => {
  let rendered = html;
  Object.entries(vars).forEach(([key, val]) => {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
  });
  return rendered;
};

const AdminEmailManager = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [emailProvider, setEmailProvider] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get("/settings/all");
      if (data) {
        setEmailProvider(data.klaviyo_connected === "true" ? "klaviyo" : "none");
      }
    } catch {
      // ignore
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.get("/admin/email-templates");
      setTemplates(data || []);
    } catch {
      toast.error("Failed to load email templates");
    }
    setLoading(false);
  };

  const toggleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      await api.put(`/admin/email-templates/${id}`, { enabled: !currentEnabled });
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, enabled: !currentEnabled } : t));
      toast.success(`Template ${currentEnabled ? "disabled" : "enabled"}`);
    } catch {
      toast.error("Failed to update");
    }
  };

  const updateTemplate = async (id: string, updates: Partial<EmailTemplate>) => {
    setSaving(id);
    try {
      await api.put(`/admin/email-templates/${id}`, updates);
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      toast.success("Template saved!");
    } catch {
      toast.error("Failed to save template");
    }
    setSaving(null);
  };

  const sendTestEmail = async (template: EmailTemplate) => {
    if (!testEmail) { toast.error("Enter a test email address"); return; }
    setSendingTest(true);
    try {
      const sampleVars = SAMPLE_DATA[template.template_key] || {};
      const renderedSubject = renderPreview(template.subject, sampleVars);
      const renderedBody = renderPreview(template.body_html, sampleVars);

      // If Klaviyo is connected, fire a test event
      if (emailProvider === "klaviyo") {
        await api.post("/admin/notifications/send-klaviyo-event", {
          event: `Test: ${template.name}`,
          email: testEmail,
          properties: { ...sampleVars, subject: renderedSubject, body_preview: template.body_text },
        });
        toast.success(`Test event sent to Klaviyo for ${testEmail}`);
      } else {
        toast.info("No email provider configured. Preview the template below to see how it would look.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send test email");
    }
    setSendingTest(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-foreground flex items-center gap-2">
            <Mail className="text-primary" size={24} /> Email Notifications
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage email templates, subjects, and notification settings for all transactional emails.
          </p>
        </div>
        <button onClick={loadTemplates} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <RefreshCw size={14} /> Reload
        </button>
      </div>

      {/* Provider Status */}
      <div className={`rounded-xl border p-4 ${emailProvider === "klaviyo" ? "bg-green-500/5 border-green-500/20" : "bg-yellow-500/5 border-yellow-500/20"}`}>
        <div className="flex items-center gap-3">
          {emailProvider === "klaviyo" ? (
            <CheckCircle2 className="text-green-400" size={20} />
          ) : (
            <AlertCircle className="text-yellow-400" size={20} />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {emailProvider === "klaviyo" ? "Klaviyo Connected" : "No Email Provider Connected"}
            </p>
            <p className="text-xs text-muted-foreground">
              {emailProvider === "klaviyo"
                ? "Emails will be sent via Klaviyo. Make sure matching templates/flows exist in your Klaviyo account."
                : "Connect Klaviyo in Settings to enable automated email sending. Templates below will be used as content reference."}
            </p>
          </div>
        </div>
      </div>

      {/* Test Email Input */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Send className="text-primary" size={16} />
          <span className="text-sm font-medium text-foreground">Test Email Address</span>
        </div>
        <div className="flex gap-2 mt-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground self-center">Used for sending test emails</span>
        </div>
      </div>

      {/* Template List */}
      <div className="space-y-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            expanded={expandedTemplate === template.id}
            previewing={previewTemplate === template.id}
            saving={saving === template.id}
            sendingTest={sendingTest}
            onToggleExpand={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
            onTogglePreview={() => setPreviewTemplate(previewTemplate === template.id ? null : template.id)}
            onToggleEnabled={() => toggleEnabled(template.id, template.enabled)}
            onSave={(updates) => updateTemplate(template.id, updates)}
            onSendTest={() => sendTestEmail(template)}
          />
        ))}
      </div>
    </div>
  );
};

/* ─── Template Card ─── */
const TemplateCard = ({
  template, expanded, previewing, saving, sendingTest,
  onToggleExpand, onTogglePreview, onToggleEnabled, onSave, onSendTest,
}: {
  template: EmailTemplate;
  expanded: boolean;
  previewing: boolean;
  saving: boolean;
  sendingTest: boolean;
  onToggleExpand: () => void;
  onTogglePreview: () => void;
  onToggleEnabled: () => void;
  onSave: (updates: Partial<EmailTemplate>) => void;
  onSendTest: () => void;
}) => {
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.body_html);
  const [bodyText, setBodyText] = useState(template.body_text);
  const isDirty = subject !== template.subject || bodyHtml !== template.body_html || bodyText !== template.body_text;

  const sampleData = SAMPLE_DATA[template.template_key] || {};

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-colors ${template.enabled ? "border-border" : "border-border/50 opacity-70"}`}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-secondary/30 transition-colors" onClick={onToggleExpand}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Mail size={16} className={template.enabled ? "text-primary" : "text-muted-foreground"} />
            <h3 className="text-sm font-semibold text-foreground">{template.name}</h3>
            {!template.enabled && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">DISABLED</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <Switch checked={template.enabled} onCheckedChange={onToggleEnabled} />
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded Editor */}
      {expanded && (
        <div className="border-t border-border px-5 py-4 space-y-4">
          {/* Variables Info */}
          <div className="bg-secondary/50 rounded-lg p-3 flex items-start gap-2">
            <Info size={14} className="text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">Available Variables</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {template.variables.map((v) => (
                  <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">{`{{${v}}}`}</code>
                ))}
              </div>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Email Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Body Editor Tabs */}
          <Tabs defaultValue="html" className="space-y-2">
            <div className="flex items-center justify-between">
              <TabsList className="bg-secondary">
                <TabsTrigger value="html" className="text-xs flex items-center gap-1"><Code size={12} /> HTML Body</TabsTrigger>
                <TabsTrigger value="text" className="text-xs flex items-center gap-1"><FileText size={12} /> Plain Text</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs flex items-center gap-1"><Eye size={12} /> Preview</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="html">
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                placeholder="HTML email body..."
              />
            </TabsContent>

            <TabsContent value="text">
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                placeholder="Plain text fallback..."
              />
            </TabsContent>

            <TabsContent value="preview">
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-secondary px-3 py-2 border-b border-border">
                  <p className="text-xs text-muted-foreground">Subject: <span className="text-foreground font-medium">{renderPreview(subject, sampleData)}</span></p>
                </div>
                <div
                  className="p-4 bg-white text-black text-sm min-h-[200px]"
                  dangerouslySetInnerHTML={{ __html: renderPreview(bodyHtml, sampleData) }}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <button
              onClick={onSendTest}
              disabled={sendingTest}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {sendingTest ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Send Test
            </button>
            <button
              onClick={() => onSave({ subject, body_html: bodyHtml, body_text: bodyText })}
              disabled={saving || !isDirty}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEmailManager;