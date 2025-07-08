
"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, Timestamp, doc, deleteDoc } from "firebase/firestore"
import { FileText, PlusCircle, ArrowRight, Trash2, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { logActivity } from "@/lib/activityLogger"

interface FormTemplate {
    id: string;
    title: string;
    description: string;
    topic: string;
    createdAt: Timestamp;
}

export default function FormTemplatesPage() {
    const [templates, setTemplates] = useState<FormTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const { toast } = useToast()
    const { user } = useAuth();
    
    const canManage = user?.role === 'admin';

    useEffect(() => {
        const fetchTemplates = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, "formTemplates"), orderBy("createdAt", "desc"));
                const querySnapshot = await getDocs(q);
                const templatesData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as FormTemplate[];
                setTemplates(templatesData);
            } catch (error) {
                console.error("Error fetching form templates: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTemplates();
    }, []);

    const handleDelete = async (templateId: string) => {
        const templateToDelete = templates.find(t => t.id === templateId);
        if (!templateToDelete) return;

        setIsDeleting(templateId)
        try {
            await deleteDoc(doc(db, "formTemplates", templateId));
            setTemplates(prev => prev.filter(template => template.id !== templateId));
            await logActivity(user, "Suppression d'un modèle de formulaire", { docId: templateId, title: templateToDelete.title });
            toast({
                title: "Modèle Supprimé",
                description: "Le modèle de formulaire a été supprimé avec succès.",
            });
        } catch (error) {
            console.error("Error deleting template: ", error);
            toast({
                variant: "destructive",
                title: "Erreur de suppression",
                description: "Impossible de supprimer le modèle de formulaire.",
            });
        } finally {
            setIsDeleting(null)
        }
    }

    const renderSkeleton = () => (
        [...Array(3)].map((_, i) => (
            <Card key={i}>
                <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                    <Skeleton className="h-4 w-1/2 mt-1" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-4 w-1/4" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-32" />
                </CardFooter>
            </Card>
        ))
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Bibliothèque de Modèles / مكتبة النماذج</h1>
                    <p className="text-muted-foreground">
                        Utilisez des modèles existants ou créez-en de nouveaux avec l'IA.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/form-builder">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Créer un modèle avec l'IA
                    </Link>
                </Button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {renderSkeleton()}
                </div>
            ) : templates.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map(template => (
                        <Card key={template.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-start gap-2">
                                    <FileText className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                                    <span>{template.title}</span>
                                </CardTitle>
                                <CardDescription>{template.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-sm text-muted-foreground">
                                    <strong>Sujet d'origine :</strong> {template.topic}
                                </p>
                            </CardContent>
                            <CardFooter className="flex justify-between items-center pt-4">
                                <Button asChild>
                                    <Link href={`/dashboard/templates/${template.id}`}>
                                        Remplir <ArrowRight className="ml-2 h-4 w-4"/>
                                    </Link>
                                </Button>
                                {canManage && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="icon">
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Supprimer</span>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Cette action est irréversible. Le modèle sera définitivement supprimé. Les soumissions existantes basées sur ce modèle ne pourront plus être consultées.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={() => handleDelete(template.id)}
                                                disabled={isDeleting === template.id}>
                                                {isDeleting === template.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Confirmer la suppression
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 border-dashed border-2 rounded-lg">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">Aucun modèle de formulaire trouvé</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Commencez par en créer un nouveau avec notre générateur IA.</p>
                </div>
            )}
        </div>
    )
}
