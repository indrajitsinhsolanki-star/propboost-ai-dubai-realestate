import { useState, useEffect } from "react";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import { 
  FileText,
  Check,
  Clock,
  Loader2
} from "lucide-react";

const DOCUMENT_LABELS = {
  passport_copy: "Passport Copy",
  emirates_id: "Emirates ID",
  visa_copy: "Visa Copy",
  salary_certificate: "Salary Certificate",
  bank_statement: "Bank Statement",
  proof_of_address: "Proof of Address"
};

export default function DocumentStatusPanel({ leadId, onUpdate }) {
  const { api } = useAuth();
  const [docStatus, setDocStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDocumentStatus();
  }, [leadId]);

  const loadDocumentStatus = async () => {
    try {
      const response = await api.getDocuments(leadId);
      setDocStatus(response.data);
    } catch (error) {
      console.error("Error loading document status:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleReceived = async (docId) => {
    if (!docStatus?.exists) return;
    
    const currentReceived = docStatus.received_docs || [];
    const newReceived = currentReceived.includes(docId)
      ? currentReceived.filter(d => d !== docId)
      : [...currentReceived, docId];
    
    setSaving(true);
    try {
      await api.updateDocuments(leadId, { received_docs: newReceived });
      setDocStatus(prev => ({
        ...prev,
        received_docs: newReceived,
        status: newReceived.length >= prev.requested_docs.length ? "complete" : 
                newReceived.length > 0 ? "partial" : "pending"
      }));
      toast.success("Document status updated");
      onUpdate?.();
    } catch (error) {
      console.error("Error updating document status:", error);
      toast.error("Failed to update document status");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1F2C34] rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!docStatus?.exists) {
    return (
      <div className="text-center py-4 text-gray-500">
        <p className="text-sm">No documents requested yet.</p>
        <p className="text-xs mt-1">Click "Request Docs" to start the document collection process.</p>
      </div>
    );
  }

  const { requested_docs = [], received_docs = [], status } = docStatus;
  const receivedCount = received_docs.length;
  const requestedCount = requested_docs.length;
  const isComplete = status === "complete";

  return (
    <div className={`bg-white dark:bg-[#1F2C34] rounded-xl p-4 border ${
      isComplete ? 'border-green-300 dark:border-green-700' : 'border-orange-300 dark:border-orange-700'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className={`w-5 h-5 ${isComplete ? 'text-green-500' : 'text-orange-500'}`} />
          <h3 className="font-semibold text-gray-900 dark:text-white">Document Status</h3>
        </div>
        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
          isComplete 
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
        }`}>
          {receivedCount}/{requestedCount} received
        </span>
      </div>
      
      <div className="space-y-2">
        {requested_docs.map(docId => {
          const isReceived = received_docs.includes(docId);
          return (
            <label 
              key={docId}
              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                isReceived 
                  ? 'bg-green-50 dark:bg-green-900/20' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Checkbox 
                checked={isReceived}
                onCheckedChange={() => toggleReceived(docId)}
                disabled={saving}
                data-testid={`doc-received-${docId}`}
              />
              <span className={`text-sm flex-1 ${
                isReceived 
                  ? 'text-green-700 dark:text-green-400 line-through' 
                  : 'text-gray-800 dark:text-gray-200'
              }`}>
                {DOCUMENT_LABELS[docId] || docId}
              </span>
              {isReceived ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Clock className="w-4 h-4 text-orange-400" />
              )}
            </label>
          );
        })}
      </div>
      
      {saving && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  );
}
