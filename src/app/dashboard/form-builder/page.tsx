
"use client"
import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Wand2, Loader2, ClipboardCheck, ArrowRight, Save } from "lucide-react"
import { Separator } from '@/components/ui/separator'
import { generateForm, FormGeneratorOutput } from '@/ai/flows/form-generator-flow'
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { useAuth } from '@/hooks/use-auth'
import { logActivity } from '@/lib/activityLogger'


// A component to render individual form fields based on the AI response
const FormFieldRenderer: React.FC<{ field: FormGeneratorOutput['fields'][0] }> = ({ field }) => {
  switch (field.type) {
    case 'title':
      return <h3 className="font-semibold text-lg pt-4">{field.label}</h3>;
    case 'separator':
      return <Separator className="my-4" />;
    case 'text':
    case 'date':
    case 'file':
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id}>{field.label}</Label>
          <Input id={field.id} type={field.type} placeholder={field.placeholder} />
        </div>
      );
    case 'textarea':
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id}>{field.label}</Label>
          <Textarea id={field.id} placeholder={field.placeholder} rows={3} />
        </div>
      );
    case 'select':
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id}>{field.label}</Label>
          <Select>
            <SelectTrigger id={field.id}><SelectValue placeholder={field.placeholder || "Sélectionner..."} /></SelectTrigger>
            <SelectContent>
              {field.options?.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    case 'checkbox':
      return (
        <div className="flex items-center space-x-2">
          <Checkbox id={field.id} />
          <Label htmlFor={field.id} className="font-normal">{field.label}</Label>
        </div>
      );
    default:
      return null;
  }
};


export default function FormBuilderPage() {
  const [topic, setTopic] = useState("Audit de sécurité pour travaux en hauteur")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedForm, setGeneratedForm] = useState<FormGeneratorOutput | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()


  const handleGenerateForm = async () => {
    if (!topic) return
    setIsGenerating(true)
    setGeneratedForm(null)
    try {
      const result = await generateForm(topic)
      setGeneratedForm(result)
      await logActivity(user, "Génération d'un formulaire par IA", { topic });
    } catch (error) {
      console.error("Error generating form:", error)
      toast({
        variant: "destructive",
        title: "Erreur de Génération",
        description: "L'IA n'a pas pu générer le formulaire. Veuillez réessayer."
      })
    } finally {
      setIsGenerating(false)
    }
  }
  
  const handleSaveForm = async () => {
    if (!generatedForm || !user) {
        toast({
            variant: "destructive",
            title: "Erreur",
            description: "Aucun formulaire généré ou utilisateur non connecté pour l'enregistrement.",
        })
        return
    }
    setIsSaving(true);
    try {
        const newDocRef = await addDoc(collection(db, "formTemplates"), {
            ...generatedForm,
            topic: topic,
            createdBy: user.uid,
            userEmail: user.email,
            createdAt: serverTimestamp(),
        });
        await logActivity(user, "Sauvegarde d'un modèle de formulaire", { docId: newDocRef.id, title: generatedForm.title });
        toast({
          title: "Modèle Enregistré",
          description: "La structure de ce formulaire a été sauvegardée avec succès.",
        })
    } catch (error) {
        console.error("Error saving form template: ", error);
        toast({
            variant: "destructive",
            title: "Erreur d'Enregistrement",
            description: "Impossible de sauvegarder le modèle de formulaire. Veuillez réessayer.",
        })
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Générateur de Formulaires (IA) / منشئ النماذج (AI)</h1>
        <p className="text-muted-foreground">
          Créez dynamiquement des formulaires d'audit et de dialogue sécurité grâce à l'IA.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Wand2 className="text-accent"/> 1. Définir le Sujet</CardTitle>
                    <CardDescription>Décrivez le type de formulaire HSE que vous souhaitez créer. L'IA proposera les champs pertinents.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label htmlFor="hse-topic">Sujet HSE / موضوع HSE</Label>
                        <Textarea
                            id="hse-topic"
                            placeholder="Ex: Audit 5S, Dialogue sécurité chariot élévateur..."
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            rows={4}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleGenerateForm} disabled={isGenerating || !topic} className="w-full bg-accent hover:bg-accent/90">
                        {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <ArrowRight className="mr-2 h-4 w-4" />
                        )}
                        {isGenerating ? "Génération en cours..." : "Générer le formulaire"}
                    </Button>
                </CardFooter>
            </Card>
        </div>

        <div className="lg:col-span-2">
            <Card className="min-h-[500px]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ClipboardCheck className="text-primary"/> 2. Prévisualisation du Formulaire</CardTitle>
                    <CardDescription>Voici un aperçu du formulaire généré. Vous pourrez le sauvegarder pour une utilisation ultérieure.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isGenerating && (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                            <p>Analyse du sujet et construction des champs...</p>
                        </div>
                    )}
                    {generatedForm && (
                        <div className="space-y-6 animate-in fade-in-50">
                             <CardTitle>{generatedForm.title}</CardTitle>
                             <CardDescription>{generatedForm.description}</CardDescription>
                             <Separator />
                             <form className="space-y-4">
                                {generatedForm.fields.map((field) => (
                                    <FormFieldRenderer key={field.id} field={field} />
                                ))}
                             </form>
                        </div>
                    )}
                     {!isGenerating && !generatedForm && (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <p>Le formulaire généré par l'IA apparaîtra ici.</p>
                        </div>
                    )}
                </CardContent>
                {generatedForm && !isGenerating && (
                  <CardFooter className="flex-col items-stretch gap-4">
                    <Separator/>
                    <Button onClick={handleSaveForm} disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                      Enregistrer ce modèle de formulaire
                    </Button>
                  </CardFooter>
                )}
            </Card>
        </div>

      </div>
    </div>
  )
}
