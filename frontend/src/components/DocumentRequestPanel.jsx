import { useState, useEffect } from "react";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { 
  X, 
  Paperclip, 
  MessageSquare, 
  Copy, 
  Check,
  Loader2,
  ExternalLink
} from "lucide-react";

const DOCUMENT_OPTIONS = [
  { id: "passport_copy", label: "Passport Copy", required: true },
  { id: "emirates_id", label: "Emirates ID (for UAE residents)", required: true },
  { id: "visa_copy", label: "Visa Copy", required: false },
  { id: "salary_certificate", label: "Salary Certificate / Bank Statement", required: false },
  { id: "proof_of_address", label: "Proof of Address", required: false },
];

export default function DocumentRequestPanel({ lead, isOpen, onClose, onSuccess }) {
  const { api } = useAuth();
  const [selectedDocs, setSelectedDocs] = useState(["passport_copy", "emirates_id"]);
  const [customMessage, setCustomMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isOpen && lead) {
      // Generate default message
      generateMessage();
    }
  }, [isOpen, lead, selectedDocs]);

  const generateMessage = () => {
    if (!lead) return;
    
    const docList = selectedDocs
      .map((id, index) => {
        const doc = DOCUMENT_OPTIONS.find(d => d.id === id);
        return doc ? `${index + 1}. ${doc.label}` : null;
      })
      .filter(Boolean)
      .join("\n");
    
    const message = `Hi ${lead.name?.split(' ')[0] || 'there'}! 👋

To proceed with your property booking, please send us the following documents:

${docList}

Simply reply to this message with photos/scans of these documents. 📎

Thank you!`;
    
    setCustomMessage(message);
  };

  const toggleDoc = (docId) => {
    setSelectedDocs(prev => 
      prev.includes(docId) 
        ? prev.filter(d => d !== docId)
        : [...prev, docId]
    );
  };

  const handleOpenWhatsApp = async () => {
    if (selectedDocs.length === 0) {
      toast.error("Please select at least one document");
      return;
    }

    const phone = lead.phone?.replace(/[^0-9]/g, '');
    if (!phone) {
      toast.error("Lead has no phone number");
      return;
    }

    // Create WhatsApp URL
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(customMessage)}`;
    
    // Open WhatsApp
    window.open(waUrl, '_blank');
    
    // Show "Mark as Sent" state
    setSent(true);
  };

  const handleMarkAsSent = async () => {
    setLoading(true);
    try {
      await api.requestDocuments(lead.id, {
        requested_docs: selectedDocs,
        message: customMessage
      });
      
      toast.success("Document request logged successfully!");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error logging document request:", error);
      toast.error("Failed to log document request");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(customMessage);
    setCopied(true);
    toast.success("Message copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-[#1F2C34] rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-[#00A884]" />
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Request Documents from {lead?.name?.split(' ')[0]}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-120px)] px-4 py-4 space-y-4">
          {/* Document Checkboxes */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select documents to request:
            </p>
            <div className="space-y-2">
              {DOCUMENT_OPTIONS.map(doc => (
                <label 
                  key={doc.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <Checkbox 
                    checked={selectedDocs.includes(doc.id)}
                    onCheckedChange={() => toggleDoc(doc.id)}
                    data-testid={`doc-${doc.id}`}
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">
                    {doc.label}
                    {doc.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Message Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                WhatsApp Message Preview:
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={generateMessage}
                className="text-xs text-[#00A884]"
              >
                Reset
              </Button>
            </div>
            <div className="bg-[#DCF8C6] dark:bg-[#005C4B] rounded-lg p-3 shadow-sm">
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={8}
                className="bg-transparent border-none resize-none text-sm text-gray-800 dark:text-white focus:ring-0 p-0"
                data-testid="doc-request-message"
              />
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1A252D] space-y-2">
          {sent ? (
            <Button 
              onClick={handleMarkAsSent}
              disabled={loading}
              className="w-full bg-[#00A884] hover:bg-[#00A884]/90 text-white rounded-full h-11"
              data-testid="mark-sent-btn"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Check className="w-4 h-4 mr-2" />Mark as Sent</>
              )}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={handleCopyMessage}
                className="flex-1 rounded-full h-11"
                data-testid="copy-message-btn"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copied!" : "Copy Message"}
              </Button>
              <Button 
                onClick={handleOpenWhatsApp}
                className="flex-1 bg-[#25D366] hover:bg-[#25D366]/90 text-white rounded-full h-11"
                data-testid="open-whatsapp-btn"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in WhatsApp
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
}
