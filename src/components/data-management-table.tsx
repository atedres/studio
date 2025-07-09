
"use client"

import React, { useState, useEffect, useCallback } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, where, deleteDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { logActivity } from "@/lib/activityLogger"
import { useForm, Controller } from "react-hook-form"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, PlusCircle, Edit, Trash2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { MultiSelect, Option } from "./ui/multi-select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form"

interface DataItem extends Record<string, any> {
    id: string;
    nom: string;
    actif: boolean;
}

interface Relation {
    collectionName?: string;
    staticOptions?: string[];
    label: string;
    fieldName: string;
}

interface DataManagementTableProps {
    collectionName: string;
    title: string;
    relations?: Relation[];
}

export function DataManagementTable({ collectionName, title, relations = [] }: DataManagementTableProps) {
    const [items, setItems] = useState<DataItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<DataItem | null>(null);
    const [relationOptions, setRelationOptions] = useState<Record<string, Option[]>>({});
    const [loadingRelations, setLoadingRelations] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();
    
    // Create a dynamic Zod schema
    const formSchema = z.object({
        nom: z.string().min(1, "Le nom est requis."),
        ...relations.reduce((acc, rel) => {
            acc[rel.fieldName] = z.array(z.string()).optional();
            return acc;
        }, {} as Record<string, z.ZodTypeAny>)
    });

    type FormValues = z.infer<typeof formSchema>;
    
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { nom: "" },
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, collectionName), orderBy("nom"));
            const querySnapshot = await getDocs(q);
            const dataList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DataItem[];
            setItems(dataList);
        } catch (error) {
            console.error(`Error fetching ${collectionName}: `, error);
            toast({ variant: "destructive", title: "Erreur", description: `Impossible de charger les données pour ${title}.` });
        } finally {
            setLoading(false);
        }
    }, [collectionName, title, toast]);
    
    const fetchRelationData = useCallback(async () => {
        if (relations.length === 0) return;
        setLoadingRelations(true);
        try {
            const options: Record<string, Option[]> = {};
            for (const rel of relations) {
                if (rel.collectionName) {
                    const q = query(collection(db, rel.collectionName), where("actif", "==", true), orderBy("nom"));
                    const snapshot = await getDocs(q);
                    options[rel.fieldName] = snapshot.docs.map(doc => ({ value: doc.data().nom, label: doc.data().nom }));
                } else if (rel.staticOptions) {
                    options[rel.fieldName] = rel.staticOptions.map(opt => ({ value: opt, label: opt }));
                }
            }
            setRelationOptions(options);
        } catch (error) {
            console.error("Error fetching relation data:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les listes de relations." });
        } finally {
            setLoadingRelations(false);
        }
    }, [relations, toast]);
    
    useEffect(() => {
        fetchData();
        fetchRelationData();
    }, [fetchData, fetchRelationData]);

    const handleToggleActive = async (item: DataItem) => {
        const itemRef = doc(db, collectionName, item.id);
        try {
            await updateDoc(itemRef, { actif: !item.actif });
            await logActivity(user, `Changement statut de "${title}"`, { name: item.nom, newStatus: !item.actif });
            setItems(prevItems => prevItems.map(i => i.id === item.id ? { ...i, actif: !i.actif } : i));
            toast({ title: "Statut mis à jour", description: `"${item.nom}" est maintenant ${item.actif ? "inactif" : "actif"}.` });
        } catch (error) {
            console.error("Error updating status: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le statut." });
        }
    };

    const handleOpenDialog = (item: DataItem | null) => {
        setEditingItem(item);
        if (item) {
            const defaultValues: FormValues = { nom: item.nom };
            relations.forEach(rel => {
                defaultValues[rel.fieldName] = item[rel.fieldName] || [];
            });
            form.reset(defaultValues);
        } else {
            const defaultValues: FormValues = { nom: "" };
            relations.forEach(rel => {
                defaultValues[rel.fieldName] = [];
            });
            form.reset(defaultValues);
        }
        setIsDialogOpen(true);
    };

    const handleFormSubmit = async (values: FormValues) => {
        const trimmedName = values.nom.trim();
        const isDuplicate = items.some(item => 
            item.nom.toLowerCase() === trimmedName.toLowerCase() && item.id !== editingItem?.id
        );
        if (isDuplicate) {
            form.setError("nom", { message: `L'élément "${trimmedName}" existe déjà.`})
            return;
        }

        const dataToSave: Record<string, any> = { nom: trimmedName };
        relations.forEach(rel => {
            dataToSave[rel.fieldName] = values[rel.fieldName] || [];
        });

        form.formState.isSubmitting = true;
        try {
            if (editingItem) {
                // Update
                const itemRef = doc(db, collectionName, editingItem.id);
                await updateDoc(itemRef, dataToSave);
                await logActivity(user, `Modification de "${title}"`, { oldName: editingItem.nom, newName: trimmedName });
                toast({ title: "Succès", description: `L'élément a été mis à jour.` });
            } else {
                // Add
                await addDoc(collection(db, collectionName), { ...dataToSave, actif: true });
                await logActivity(user, `Ajout à "${title}"`, { name: trimmedName });
                toast({ title: "Succès", description: `"${trimmedName}" a été ajouté.` });
            }
            setIsDialogOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving item: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'élément." });
        } finally {
            form.formState.isSubmitting = false;
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        const itemToDelete = items.find(i => i.id === itemId);
        if (!itemToDelete) return;

        form.formState.isSubmitting = true;
        const itemRef = doc(db, collectionName, itemId);
        try {
            await deleteDoc(itemRef);
            await logActivity(user, `Suppression de "${title}"`, { name: itemToDelete.nom });
            toast({ title: "Succès", description: "L'élément a été supprimé." });
            fetchData();
        } catch (error) {
            console.error("Error deleting document: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'élément." });
        } finally {
             form.formState.isSubmitting = false;
        }
    }

    return (
        <div>
            <div className="flex justify-end mb-4">
                 <Button onClick={() => handleOpenDialog(null)}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter</Button>
            </div>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead>Éléments Liés</TableHead>
                            <TableHead className="w-[100px]">Actif</TableHead>
                            <TableHead className="w-[120px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Skeleton className="h-8 w-8 inline-block" />
                                        <Skeleton className="h-8 w-8 inline-block" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : items.length > 0 ? (
                            items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.nom}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {relations.map(rel => {
                                            const relatedItems = item[rel.fieldName] as string[] | undefined;
                                            if (!relatedItems || relatedItems.length === 0) return null;
                                            return (
                                                <div key={rel.fieldName}>
                                                    <strong className="font-semibold">{rel.label}:</strong> {relatedItems.join(", ")}
                                                </div>
                                            )
                                        })}
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={item.actif}
                                            onCheckedChange={() => handleToggleActive(item)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)}>
                                            <Edit className="h-4 w-4" />
                                            <span className="sr-only">Modifier</span>
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="sr-only">Supprimer</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Cette action est irréversible. L'élément "{item.nom}" sera définitivement supprimé.
                                                </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    className={cn(buttonVariants({ variant: "destructive" }))}
                                                    disabled={form.formState.isSubmitting}
                                                >
                                                   {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Supprimer
                                                </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    Aucun élément trouvé.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? `Modifier "${editingItem.nom}"` : `Ajouter à "${title}"`}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                             <FormField
                                control={form.control}
                                name="nom"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nom</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Nom de l'élément" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {relations.map(rel => (
                                 <FormField
                                    key={rel.fieldName}
                                    control={form.control}
                                    name={rel.fieldName as any}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{rel.label}</FormLabel>
                                            <FormControl>
                                                <MultiSelect
                                                    options={relationOptions[rel.fieldName] || []}
                                                    selected={field.value || []}
                                                    onChange={field.onChange}
                                                    placeholder={`Sélectionner...`}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ))}
                            <DialogFooter>
                                 <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Enregistrer
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
