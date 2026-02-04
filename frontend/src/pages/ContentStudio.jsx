import { useState, useEffect } from "react";
import { useAuth } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Sparkles, MapPin, Copy, CheckCircle, Loader2, Instagram, Facebook, MessageSquare, Mail, Search, X, Building2 } from "lucide-react";

const PLATFORMS = [
  { id: "instagram", label: "Instagram", color: "bg-pink-500" },
  { id: "facebook", label: "Facebook", color: "bg-blue-600" },
  { id: "whatsapp", label: "WhatsApp", color: "bg-green-500" },
  { id: "email", label: "Email", color: "bg-purple-500" },
  { id: "seo", label: "SEO", color: "bg-orange-500" },
];

const LANGUAGES = ["English", "Arabic", "Hindi", "Russian", "Mandarin", "French"];

const getPlatformIcon = (id) => {
  switch(id) {
    case "instagram": return Instagram;
    case "facebook": return Facebook;
    case "whatsapp": return MessageSquare;
    case "email": return Mail;
    case "seo": return Search;
    default: return Search;
  }
};

export default function ContentStudio() {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [generatedContent, setGeneratedContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState(["instagram", "facebook"]);
  const [selectedLanguages, setSelectedLanguages] = useState(["English", "Arabic"]);
  const [activePlatform, setActivePlatform] = useState("instagram");
  const [activeLanguage, setActiveLanguage] = useState("English");
  
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(2);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [amenities, setAmenities] = useState([]);
  const [description, setDescription] = useState("");
  const [propertyType, setPropertyType] = useState("Apartment");
  const [areaSqft, setAreaSqft] = useState("");
  const [amenityInput, setAmenityInput] = useState("");

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const response = await api.getProperties();
      setProperties(response.data);
    } catch (error) {
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setLocation("");
    setBedrooms(2);
    setBathrooms(2);
    setPrice("");
    setCurrency("AED");
    setAmenities([]);
    setDescription("");
    setPropertyType("Apartment");
    setAreaSqft("");
    setAmenityInput("");
  };

  const handleCreateProperty = async () => {
    if (!title || !location || !price) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      const response = await api.createProperty({
        title,
        location,
        bedrooms,
        bathrooms,
        price: parseFloat(price),
        currency,
        amenities,
        description,
        property_type: propertyType,
        area_sqft: parseInt(areaSqft) || 0,
        images: []
      });
      setProperties([response.data, ...properties]);
      setShowAddDialog(false);
      setSelectedProperty(response.data);
      resetForm();
      toast.success("Property added successfully!");
    } catch (error) {
      toast.error("Failed to create property");
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateContent = async () => {
    if (!selectedProperty) {
      toast.error("Please select a property first");
      return;
    }

    setGenerating(true);
    try {
      const response = await api.generateContent({
        property_id: selectedProperty.id,
        platforms: selectedPlatforms,
        languages: selectedLanguages
      });
      setGeneratedContent(response.data.contents);
      toast.success(`Generated ${response.data.count} content pieces!`);
    } catch (error) {
      toast.error("Failed to generate content");
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveContent = async (contentId) => {
    try {
      await api.approveContent(contentId, true);
      setGeneratedContent(generatedContent.map(c => 
        c.id === contentId ? {...c, approved: true} : c
      ));
      toast.success("Content approved!");
    } catch (error) {
      toast.error("Failed to approve content");
    }
  };

  const handleCopyContent = (text, hashtags) => {
    const fullText = hashtags ? `${text}\n\n${hashtags}` : text;
    navigator.clipboard.writeText(fullText);
    toast.success("Content copied to clipboard!");
  };

  const addAmenity = () => {
    if (amenityInput.trim() && !amenities.includes(amenityInput.trim())) {
      setAmenities([...amenities, amenityInput.trim()]);
      setAmenityInput("");
    }
  };

  const removeAmenity = (amenity) => {
    setAmenities(amenities.filter(a => a !== amenity));
  };

  const togglePlatform = (platformId) => {
    if (selectedPlatforms.includes(platformId)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platformId));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platformId]);
    }
  };

  const toggleLanguage = (lang) => {
    if (selectedLanguages.includes(lang)) {
      setSelectedLanguages(selectedLanguages.filter(l => l !== lang));
    } else {
      setSelectedLanguages([...selectedLanguages, lang]);
    }
  };

  const filteredContent = generatedContent.filter(
    c => c.platform === activePlatform && c.language === activeLanguage
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Content Studio
          </h1>
          <p className="text-gray-500 mt-1">Generate AI content in 6 languages</p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="add-property-btn" className="bg-[#001F3F] hover:bg-[#001F3F]/90 text-white rounded-full px-6">
              <Plus className="w-4 h-4 mr-2" />Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold" style={{ fontFamily: 'Playfair Display, serif' }}>
                Add New Property
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Property Title *</Label>
                <Input data-testid="property-title-input" placeholder="e.g., Stunning Sea View Apartment" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Location *</Label>
                  <Input data-testid="property-location-input" placeholder="e.g., Palm Jumeirah" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Property Type</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger data-testid="property-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Apartment">Apartment</SelectItem>
                      <SelectItem value="Villa">Villa</SelectItem>
                      <SelectItem value="Townhouse">Townhouse</SelectItem>
                      <SelectItem value="Penthouse">Penthouse</SelectItem>
                      <SelectItem value="Studio">Studio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bedrooms</Label>
                  <Input data-testid="property-bedrooms-input" type="number" min="0" value={bedrooms} onChange={(e) => setBedrooms(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Bathrooms</Label>
                  <Input data-testid="property-bathrooms-input" type="number" min="0" value={bathrooms} onChange={(e) => setBathrooms(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Area (sqft)</Label>
                  <Input data-testid="property-area-input" type="number" placeholder="1500" value={areaSqft} onChange={(e) => setAreaSqft(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price *</Label>
                  <Input data-testid="property-price-input" type="number" placeholder="2500000" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amenities</Label>
                <div className="flex gap-2">
                  <Input placeholder="e.g., Pool, Gym" value={amenityInput} onChange={(e) => setAmenityInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())} />
                  <Button type="button" variant="outline" onClick={addAmenity}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {amenities.map((amenity, idx) => (
                    <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                      {amenity}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => removeAmenity(amenity)} />
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea data-testid="property-description-input" placeholder="Describe the property..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <Button data-testid="submit-property-btn" onClick={handleCreateProperty} disabled={creating} className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white rounded-full">
                {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : <><Building2 className="w-4 h-4 mr-2" />Add Property</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg" style={{ fontFamily: 'Playfair Display, serif' }}>Select Property</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {loading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}</div>
                ) : properties.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No properties yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {properties.map((property) => (
                      <div key={property.id} data-testid={`property-card-${property.id}`} onClick={() => setSelectedProperty(property)}
                        className={`p-3 rounded-xl cursor-pointer transition-all ${selectedProperty?.id === property.id ? 'bg-[#001F3F] text-white' : 'bg-gray-50 hover:bg-gray-100'}`}>
                        <h4 className="font-medium text-sm">{property.title}</h4>
                        <div className="flex items-center gap-2 mt-1 text-xs opacity-70"><MapPin className="w-3 h-3" />{property.location}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span>{property.bedrooms} BR</span><span>•</span>
                          <span className="text-[#D4AF37]">{property.price.toLocaleString()} {property.currency}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg" style={{ fontFamily: 'Playfair Display, serif' }}>Generation Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Platforms</Label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((platform) => (
                    <Badge key={platform.id} data-testid={`platform-${platform.id}`}
                      variant={selectedPlatforms.includes(platform.id) ? "default" : "outline"}
                      className={`cursor-pointer ${selectedPlatforms.includes(platform.id) ? platform.color : ''}`}
                      onClick={() => togglePlatform(platform.id)}>
                      {platform.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm mb-2 block">Languages</Label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <Badge key={lang} data-testid={`language-${lang}`}
                      variant={selectedLanguages.includes(lang) ? "default" : "outline"}
                      className={`cursor-pointer ${selectedLanguages.includes(lang) ? 'bg-[#001F3F]' : ''}`}
                      onClick={() => toggleLanguage(lang)}>
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button data-testid="generate-content-btn" onClick={handleGenerateContent} disabled={generating || !selectedProperty}
                className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white rounded-full">
                {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Content</>}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="bg-white border border-gray-100 shadow-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg" style={{ fontFamily: 'Playfair Display, serif' }}>Generated Content</CardTitle>
            </CardHeader>
            <CardContent>
              {generatedContent.length === 0 ? (
                <div className="text-center py-16">
                  <Sparkles className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-500">No content generated yet</h3>
                  <p className="text-sm text-gray-400 mt-1">Select a property and click Generate Content</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Tabs value={activePlatform} onValueChange={setActivePlatform}>
                    <TabsList className="bg-gray-100 p-1 rounded-full w-full flex overflow-x-auto">
                      {PLATFORMS.filter(p => selectedPlatforms.includes(p.id)).map((platform) => (
                        <TabsTrigger key={platform.id} value={platform.id} data-testid={`content-tab-${platform.id}`}
                          className="flex-1 rounded-full data-[state=active]:bg-white">
                          {platform.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selectedLanguages.map((lang) => (
                      <Button key={lang} variant={activeLanguage === lang ? "default" : "outline"} size="sm"
                        data-testid={`content-lang-${lang}`} onClick={() => setActiveLanguage(lang)}
                        className={`rounded-full whitespace-nowrap ${activeLanguage === lang ? 'bg-[#001F3F]' : ''}`}>
                        {lang}
                      </Button>
                    ))}
                  </div>
                  {filteredContent.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl"><p className="text-gray-500">No content for this combination</p></div>
                  ) : (
                    filteredContent.map((content) => (
                      <div key={content.id} className="p-4 bg-gray-50 rounded-xl space-y-3" dir={content.language === 'Arabic' ? 'rtl' : 'ltr'}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">[AI-Generated]</Badge>
                            {content.approved && <Badge className="bg-green-500 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>}
                          </div>
                        </div>
                        <p className="text-gray-700 whitespace-pre-wrap">{content.content}</p>
                        {content.hashtags && <p className="text-blue-500 text-sm">{content.hashtags}</p>}
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline" data-testid={`copy-content-${content.id}`} onClick={() => handleCopyContent(content.content, content.hashtags)} className="rounded-full">
                            <Copy className="w-4 h-4 mr-1" />Copy
                          </Button>
                          {!content.approved && (
                            <Button size="sm" data-testid={`approve-content-${content.id}`} onClick={() => handleApproveContent(content.id)} className="rounded-full bg-green-500 hover:bg-green-600">
                              <CheckCircle className="w-4 h-4 mr-1" />Approve
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
